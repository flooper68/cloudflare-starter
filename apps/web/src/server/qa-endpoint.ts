import {
  QA_TOKEN_HEADER,
  type QaBypassSettings,
  timingSafeEqual,
} from "@cloudflare-starter/features";
import type { APIContext } from "astro";

import type { AppEnv } from "@/server/env";
import {
  httpAttributes,
  internalErrorResponse,
  problemResponse,
} from "@/server/http";
import { buildPlatform, loggerFor } from "@/server/platform";
import { rateLimitPolicyHeader } from "@/server/rate-limit-headers";
import {
  rateLimitedResponse,
  refuseOverLimit,
} from "@/server/rate-limited-response";

/** Headers of every answer of a QA endpoint. */
export const QA_ENDPOINT_HEADERS = {
  "RateLimit-Policy": rateLimitPolicyHeader(["qa.bypass"]),
  "cache-control": "no-store",
};

/**
 * The gate of the QA suite's endpoints (/api/qa/*): 404 with QA_BYPASS=off, as if they did
 * not exist; every request counted against `qa.bypass` per IP before the token is compared;
 * 401 without the right `X-QA-Token` (constant-time compare, a warning without the token).
 * Authorized by the token, not a session, so no Origin check: a cross-site request can do
 * no more than the token allows. Unexpected errors answer 500 with a reference.
 */
export async function qaEndpoint(
  env: AppEnv,
  context: APIContext,
  route: string,
  /** The policy that limits it: `qa.bypass` (named by each route, for abuse.test.ts). */
  policy: "qa.bypass",
  run: (bypass: QaBypassSettings) => Promise<Response>
): Promise<Response> {
  const { request, url, locals } = context;
  const platform = buildPlatform(env);
  if (!platform.qaBypass) return new Response("Not Found", { status: 404 });
  const refused = await refuseOverLimit(
    platform,
    policy,
    { userId: null, ip: locals.requestContext.ip },
    (error) => rateLimitedResponse(error, locals.requestContext, url.pathname)
  );
  if (refused) return refused;
  const presented = request.headers.get(QA_TOKEN_HEADER) ?? "";
  if (!timingSafeEqual(presented, platform.qaBypass.token)) {
    loggerFor(platform, locals.requestContext).warn("qa.endpoint.refused", {
      "http.route": route,
      "app.qa_bypass.reason": presented ? "wrong_token" : "missing_token",
    });
    return problemResponse(
      401,
      "Unauthorized",
      "The QA token is missing or wrong."
    );
  }
  try {
    return await run(platform.qaBypass);
  } catch (error) {
    return internalErrorResponse(env, error, locals.requestContext, {
      ...httpAttributes(request),
      "http.route": route,
    });
  }
}
