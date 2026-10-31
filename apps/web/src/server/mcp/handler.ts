import {
  findUserById,
  getSecurityState,
  type RateLimitedError,
  type RequestContext,
  systemClock,
} from "@cloudflare-starter/features";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createLocalJWKSet, type JWTPayload, jwtVerify } from "jose";

import { buildRequiredConfig } from "@/lib/env";
import { AUTH_BASE_PATH, getAuth, mcpResource } from "@/server/auth";
import { getDb } from "@/server/db";
import type { AppEnv } from "@/server/env";
import { withHeaders } from "@/server/http";
import { buildPlatform } from "@/server/platform";
import {
  rateLimitedHeaders,
  rateLimitPolicyHeader,
} from "@/server/rate-limit-headers";
import { refuseOverLimit } from "@/server/rate-limited-response";
import { createAppContext } from "@/server/trpc/context";

import { buildMcpServer, callerInSpan } from "./server";

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

/**
 * A refused request: HTTP 429 with a JSON-RPC error (MCP clients read JSON-RPC, not
 * Problem Details), Retry-After and the RateLimit header fields.
 */
function tooManyRequests(
  error: RateLimitedError,
  requestContext: RequestContext
): Response {
  return Response.json(
    {
      jsonrpc: "2.0",
      error: {
        code: -32029,
        message: error.message,
        data: {
          code: error.code,
          retryAfterSeconds: error.retryAfterSeconds,
          reference: requestContext.traceId,
        },
      },
      id: null,
    },
    {
      status: 429,
      headers: rateLimitedHeaders(error.policy, error.retryAfterSeconds),
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
  env: AppEnv,
  requestContext: RequestContext
): Promise<Response> {
  const appUrl = buildRequiredConfig(env).APP_URL.replace(/\/+$/, "");
  const platform = buildPlatform(env);
  const { ip } = requestContext;
  const refuse = (error: RateLimitedError) =>
    tooManyRequests(error, requestContext);

  // Per IP before any token work, so invalid tokens cannot be tried at full speed.
  const byIp = await refuseOverLimit(
    platform,
    "mcp.ip",
    { userId: null, ip },
    refuse
  );
  if (byIp) return byIp;

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

  // The user is read from D1 on every request, so a deleted or suspended user loses
  // access at once (a refreshed token is refused here too).
  const user = await findUserById(
    { db: getDb(env), clock: systemClock },
    String(claims.sub)
  );
  if (!user) return unauthorized(appUrl, "invalid_token");

  const byUser = await refuseOverLimit(
    platform,
    "mcp.user",
    { userId: user.id, ip },
    refuse
  );
  if (byUser) return byUser;

  const authSessionId =
    typeof claims.starter_session_id === "string"
      ? claims.starter_session_id
      : null;
  const security = await getSecurityState(
    { db: getDb(env), clock: systemClock },
    {
      userId: user.id,
      sessionId: authSessionId,
      settings: buildRequiredConfig(env).security,
    }
  );
  if (
    !authSessionId ||
    !security.sessionValid ||
    security.decision !== "allowed"
  )
    return unauthorized(appUrl, "invalid_token");
  const context = createAppContext(user, requestContext, env, {
    authSessionId,
  });
  const handler = createMcpHandler(
    () => buildMcpServer(callerInSpan(context), context),
    {
      // Protocol-level failures (malformed JSON-RPC, transport); tool errors are results.
      onerror: (error) => context.logger.error("mcp.error", { error }),
    }
  );

  const response = await handler.fetch(request, {
    authInfo: {
      token,
      clientId: String(claims.azp),
      scopes: typeof claims.scope === "string" ? claims.scope.split(" ") : [],
      ...(typeof claims.exp === "number" ? { expiresAt: claims.exp } : {}),
      resource: new URL(mcpResource(appUrl)),
    },
  });
  return withHeaders(response, {
    "RateLimit-Policy": rateLimitPolicyHeader(["mcp.ip", "mcp.user"]),
  });
}
