/**
 * A minimal MCP client, as Claude connects: dynamic client registration (RFC 7591), the
 * authorization code flow with PKCE through the real consent page, and JSON-RPC tool
 * calls on /mcp with the bearer token. The redirect URI's host is never reached: the
 * page answers it locally and keeps the code.
 */
import { createHash, randomBytes } from "node:crypto";
import type { Page } from "@playwright/test";

import { qaEnv } from "./env";
import { expect } from "./fixture";
import { apiHeaders, authSlot, open } from "./session";

const CALLBACK = "https://qa-client.example.test/oauth/callback";
const SCOPE = "openid profile email offline_access";

export interface McpConnection {
  readonly clientName: string;
  readonly accessToken: string;
}

/** Registers a client and lets the signed-in person allow it on the consent page. */
export async function connectMcpClient(
  page: Page,
  clientName: string
): Promise<McpConnection> {
  const { baseUrl } = qaEnv();
  const resource = `${baseUrl}/mcp`;
  await authSlot("/oauth2/register");
  const registered = await page.request.post("/api/auth/oauth2/register", {
    headers: apiHeaders(),
    data: {
      client_name: clientName,
      redirect_uris: [CALLBACK],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: SCOPE,
      resources: [resource],
    },
  });
  expect(registered.status()).toBe(201);
  const { client_id: clientId } = (await registered.json()) as {
    client_id: string;
  };

  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  let code: string | null = null;
  await page.route(`${CALLBACK}*`, (route) => {
    code = new URL(route.request().url()).searchParams.get("code");
    return route.fulfill({ contentType: "text/plain", body: "connected" });
  });
  const authorize = new URLSearchParams({
    client_id: clientId,
    redirect_uri: CALLBACK,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    scope: SCOPE,
    resource,
    state: "qa-state",
    prompt: "consent",
  });
  await open(page, `/api/auth/oauth2/authorize?${authorize}`);
  await expect(page).toHaveURL(/\/consent\?/);
  await expect(
    page.getByRole("heading", { name: "Allow access?" })
  ).toBeVisible();
  await expect(page.getByText(clientName)).toBeVisible();
  const permissions = page.getByRole("list", { name: "Permissions requested" });
  await expect(permissions).toContainText(
    "Use the app's tools as you, in your workspaces"
  );
  await expect(permissions).toContainText("See your email address");
  await expect(permissions).toContainText("Stay connected until you revoke it");
  await expect(page.getByText(/Settings › Connected agents/)).toBeVisible();
  await page.getByRole("button", { name: "Allow" }).click();
  await expect.poll(() => code).not.toBeNull();

  await authSlot("/oauth2/token");
  const token = await page.request.post("/api/auth/oauth2/token", {
    headers: apiHeaders(),
    form: {
      grant_type: "authorization_code",
      client_id: clientId,
      code: code ?? "",
      code_verifier: verifier,
      redirect_uri: CALLBACK,
      resource,
    },
  });
  expect(token.status()).toBe(200);
  const { access_token: accessToken } = (await token.json()) as {
    access_token: string;
  };
  return { clientName, accessToken };
}

export interface ToolResult {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  /** The tool's structured result (or its text content parsed as JSON), when it answered. */
  readonly data: unknown;
  readonly isError: boolean;
}

/** Calls an MCP tool over Streamable HTTP; the answer may be JSON or one SSE event. */
export async function callTool(
  page: Page,
  connection: McpConnection,
  name: string,
  args: Record<string, unknown> = {}
): Promise<ToolResult> {
  const response = await page.request.post("/mcp", {
    headers: {
      authorization: `Bearer ${connection.accessToken}`,
      accept: "application/json, text/event-stream",
      "x-qa-token": qaEnv().qaToken,
    },
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    },
  });
  const raw = await response.text();
  const json = raw.trimStart().startsWith("{")
    ? raw
    : (raw
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .pop() ?? "null");
  const message = JSON.parse(json || "null") as {
    result?: {
      structuredContent?: unknown;
      content?: { type: string; text?: string }[];
      isError?: boolean;
    };
  } | null;
  const result = message?.result;
  let data: unknown = result?.structuredContent;
  if (data === undefined) {
    const text = result?.content?.find((part) => part.type === "text")?.text;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = text;
    }
  }
  return {
    status: response.status(),
    headers: response.headers(),
    data,
    isError: result?.isError === true,
  };
}
