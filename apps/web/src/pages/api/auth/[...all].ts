import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";

import { AUTH_BASE_PATH, getAuth } from "@/server/auth";
import { buildPlatform } from "@/server/platform";
import {
  betterAuthResponse,
  rateLimitedResponse,
  refuseOverLimit,
} from "@/server/rate-limited-response";

/**
 * Better Auth. A cheap per-IP edge limit (`auth.ip`) runs first; Better Auth then applies
 * its own per-path limits in D1 and the human check on sign-up, sign-in and reset.
 * Refusals are Problem Details with Retry-After and RateLimit header fields.
 */
const ADMIN_PREFIX = `${AUTH_BASE_PATH}/admin/`;

export const ALL: APIRoute = async ({ request, locals }) => {
  const { requestContext } = locals;
  const instance = new URL(request.url).pathname;
  // Better Auth's admin endpoints are closed (disabledPaths in server/auth.ts); this also
  // covers any spelling its path matching might accept. The portal uses admin.* procedures.
  if (instance.toLowerCase().startsWith(ADMIN_PREFIX)) {
    return new Response("Not Found", { status: 404 });
  }
  const refused = await refuseOverLimit(
    buildPlatform(env),
    "auth.ip",
    { userId: null, ip: requestContext.ip },
    (error) => rateLimitedResponse(error, requestContext, instance)
  );
  if (refused) return refused;
  return betterAuthResponse(
    request,
    await getAuth(env).handler(request),
    requestContext,
    AUTH_BASE_PATH
  );
};
