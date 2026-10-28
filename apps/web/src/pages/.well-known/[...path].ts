import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";

import { getAuth } from "@/server/auth";

/**
 * OAuth discovery documents at the origin root, where MCP clients look for them:
 *  - /.well-known/oauth-protected-resource/mcp         (RFC 9728)
 *  - /.well-known/oauth-authorization-server/api/auth  (RFC 8414)
 *  - /.well-known/openid-configuration/api/auth        (OIDC discovery)
 * Better Auth's MCP plugin answers them.
 */
export const GET: APIRoute = ({ request }) => getAuth(env).handler(request);
