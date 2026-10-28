import { eq, user as userTable } from "@cloudflare-starter/features";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createLocalJWKSet, type JWTPayload, jwtVerify } from "jose";

import { buildRequiredConfig } from "@/lib/env";
import { AUTH_BASE_PATH, getAuth, mcpResource } from "@/server/auth";
import { getDb } from "@/server/db";
import type { AppEnv } from "@/server/env";
import { createAppContext } from "@/server/trpc/context";
import { appRouter } from "@/server/trpc/router";

import { buildMcpServer } from "./server";

export const PROTECTED_RESOURCE_METADATA_PATH =
  "/.well-known/oauth-protected-resource/mcp";

function unauthorized(appUrl: string, error?: "invalid_token"): Response {
  const params = [
    `resource_metadata="${appUrl}${PROTECTED_RESOURCE_METADATA_PATH}"`,
  ];
  if (error) params.push(`error="${error}"`);
  return Response.json(
    {
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized" },
      id: null,
    },
    {
      status: 401,
      headers: { "WWW-Authenticate": `Bearer ${params.join(", ")}` },
    }
  );
}

/** Verifies a Better Auth MCP access token with the keys read in-process (no self-fetch). */
async function verifyAccessToken(
  env: AppEnv,
  appUrl: string,
  token: string
): Promise<JWTPayload> {
  const jwks = await getAuth(env).api.getJwks();
  const { payload } = await jwtVerify(
    token,
    createLocalJWKSet(jwks as Parameters<typeof createLocalJWKSet>[0]),
    {
      issuer: `${appUrl}${AUTH_BASE_PATH}`,
      audience: mcpResource(appUrl),
      requiredClaims: ["sub", "azp"],
    }
  );
  return payload;
}

/** `/mcp`: OAuth-protected, stateless Streamable HTTP MCP endpoint. */
export async function handleMcp(
  request: Request,
  env: AppEnv
): Promise<Response> {
  const appUrl = buildRequiredConfig(env).APP_URL.replace(/\/+$/, "");
  const token = /^Bearer\s+(.+)$/i
    .exec(request.headers.get("Authorization") ?? "")?.[1]
    ?.trim();
  if (!token) return unauthorized(appUrl);

  let claims: JWTPayload;
  try {
    claims = await verifyAccessToken(env, appUrl, token);
  } catch {
    return unauthorized(appUrl, "invalid_token");
  }

  // The user is read from D1 on every request, so a deleted user loses access at once.
  const row = await getDb(env).query.user.findFirst({
    where: eq(userTable.id, String(claims.sub)),
  });
  if (!row) return unauthorized(appUrl, "invalid_token");

  const caller = appRouter.createCaller(
    createAppContext({ id: row.id, email: row.email, name: row.name })
  );
  const handler = createMcpHandler(() => buildMcpServer(caller), {
    onerror: (error) => console.error("MCP error", error),
  });

  return handler.fetch(request, {
    authInfo: {
      token,
      clientId: String(claims.azp),
      scopes: typeof claims.scope === "string" ? claims.scope.split(" ") : [],
      ...(typeof claims.exp === "number" ? { expiresAt: claims.exp } : {}),
      resource: new URL(mcpResource(appUrl)),
    },
  });
}
