/**
 * The real MCP OAuth flow for API tests: dynamic client registration, authorize, the
 * consent the consent page posts, the code exchange, and calls to `/mcp` with the token.
 */
import { expect } from "vitest";

import { getAuth } from "@/server/auth";
import type { AppEnv } from "@/server/env";
import { handleMcp } from "@/server/mcp/handler";

import {
  APP_URL,
  humanHeaders,
  type TestUser,
  testRequestContext,
} from "./helpers";

let ip = 0;
const nextIp = () => `198.51.100.${(++ip % 200) + 30}`;

function cookies(response: Response, previous = "") {
  const map = new Map(
    previous
      .split("; ")
      .filter(Boolean)
      .map((value) => {
        const i = value.indexOf("=");
        return [value.slice(0, i), value.slice(i + 1)];
      })
  );
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(";")[0] ?? "";
    const i = pair.indexOf("=");
    if (i > 0) map.set(pair.slice(0, i), pair.slice(i + 1));
  }
  return [...map].map(([key, value]) => `${key}=${value}`).join("; ");
}

const post = (runtime: AppEnv, path: string, body: unknown, cookie = "") =>
  getAuth(runtime).handler(
    new Request(`${APP_URL}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: APP_URL,
        cookie,
        ...humanHeaders(nextIp()),
      },
      body: JSON.stringify(body),
    })
  );

/** `POST /api/auth/oauth2/token` as a public client sends it. */
export const tokenRequest = (runtime: AppEnv, body: Record<string, string>) =>
  getAuth(runtime).handler(
    new Request(`${APP_URL}/api/auth/oauth2/token`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        ...humanHeaders(nextIp()),
      },
      body: new URLSearchParams(body),
    })
  );

/** One JSON-RPC request to `/mcp` with the token (default: `initialize`). */
export async function mcpRequest(
  runtime: AppEnv,
  token: string,
  body: { readonly method: string; readonly params?: unknown } = {
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "api-test", version: "1" },
    },
  }
) {
  return handleMcp(
    new Request(`${APP_URL}/mcp`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, ...body }),
    }),
    runtime,
    testRequestContext()
  );
}

/** The JSON-RPC body of an `/mcp` response (JSON or a single SSE event). */
export async function rpcBody(response: Response) {
  const text = await response.text();
  const json = text.startsWith("{")
    ? text
    : (text.split("\n").find((line) => line.startsWith("data: ")) ?? "").slice(
        6
      );
  return JSON.parse(json);
}

/** Registers a public MCP client (RFC 7591) and returns its id. */
async function register(
  runtime: AppEnv,
  options: { readonly clientName?: string }
): Promise<string> {
  const registered = await post(runtime, "/oauth2/register", {
    client_name: options.clientName ?? "Security review client",
    redirect_uris: ["https://client.example.test/callback"],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    scope: "openid profile email offline_access",
    resources: [`${APP_URL}/mcp`],
  });
  expect(registered.status).toBe(201);
  return ((await registered.json()) as { client_id: string }).client_id;
}

/**
 * Connects a new MCP client as `user` through the real flow (prompt=consent, Allow) and
 * returns its client id and tokens; the access token already works at `/mcp`.
 */
export async function connectAgent(
  runtime: AppEnv,
  user: TestUser,
  options: {
    readonly clientName?: string;
    /** Authorize this already registered client again instead of registering one. */
    readonly clientId?: string;
  } = {}
) {
  const redirect = "https://client.example.test/callback";
  const clientId = options.clientId ?? (await register(runtime, options));
  const verifier =
    "security-review-verifier-0123456789abcdefghijklmnopqrstuvwxyz-0123456789";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    scope: "openid profile email offline_access",
    resource: `${APP_URL}/mcp`,
    state: "security-review-state",
    prompt: "consent",
  });
  const request = await getAuth(runtime).handler(
    new Request(`${APP_URL}/api/auth/oauth2/authorize?${query}`, {
      headers: { cookie: user.cookie },
    })
  );
  expect(request.status).toBe(302);
  const consentUrl = new URL(request.headers.get("location") ?? "", APP_URL);
  expect(consentUrl.pathname).toBe("/consent");
  const consent = await post(
    runtime,
    "/oauth2/consent",
    { accept: true, oauth_query: consentUrl.search.slice(1) },
    cookies(request, user.cookie)
  );
  expect(consent.status).toBe(200);
  const { url } = (await consent.json()) as { url: string };
  const code = new URL(url).searchParams.get("code");
  expect(code).toBeTruthy();
  const token = await tokenRequest(runtime, {
    grant_type: "authorization_code",
    client_id: clientId,
    code: code ?? "",
    code_verifier: verifier,
    redirect_uri: redirect,
    resource: `${APP_URL}/mcp`,
  });
  expect(token.status).toBe(200);
  const tokens = (await token.json()) as {
    access_token: string;
    refresh_token: string;
  };
  expect(tokens.refresh_token).toBeTruthy();
  expect((await mcpRequest(runtime, tokens.access_token)).status).toBe(200);
  return { clientId, ...tokens };
}

/**
 * Where `/oauth2/authorize` sends an already registered client of `user` without
 * `prompt=consent`: back to the client with a code while the consent is on record, to the
 * consent page once it is gone.
 */
export async function authorizeAgain(
  runtime: AppEnv,
  user: TestUser,
  clientId: string
): Promise<URL> {
  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: "https://client.example.test/callback",
    response_type: "code",
    code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    code_challenge_method: "S256",
    scope: "openid profile email offline_access",
    resource: `${APP_URL}/mcp`,
    state: "again",
  });
  const response = await getAuth(runtime).handler(
    new Request(`${APP_URL}/api/auth/oauth2/authorize?${query}`, {
      headers: { cookie: user.cookie },
    })
  );
  expect(response.status).toBe(302);
  return new URL(response.headers.get("location") ?? "", APP_URL);
}
