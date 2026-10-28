import {
  authPathPolicy,
  enforceRateLimit,
  HumanCheckFailedError,
  HumanCheckUnavailableError,
  type LimitSubject,
  RateLimitedError,
  type RateLimiter,
  type RateLimitPolicyId,
  type RequestContext,
} from "@cloudflare-starter/features";

import { problemResponse, withHeaders } from "@/server/http";
import {
  rateLimitedHeaders,
  rateLimitPolicyHeader,
} from "@/server/rate-limit-headers";

/** Where the starter documents its own problem types; a project points it at its docs. */
const DOCS =
  "https://github.com/flooper68/cloudflare-starter/blob/main/docs/guides/how-to-configure-abuse-protection.md";

/** RFC 9457 problem types of abuse protection. */
export const ABUSE_PROBLEM_TYPES = {
  /** Proposed by draft-ietf-httpapi-ratelimit-headers for 429s. */
  quotaExceeded:
    "https://iana.org/assignments/http-problem-types#quota-exceeded",
  humanCheckFailed: `${DOCS}#human-check-failed`,
  humanCheckUnavailable: `${DOCS}#human-check-unavailable`,
} as const;

/**
 * A refused request on a non-tRPC route: 429 Problem Details (quota-exceeded) with
 * Retry-After and the RateLimit header fields; `reference` is the trace id.
 */
export function rateLimitedResponse(
  error: RateLimitedError,
  requestContext: Pick<RequestContext, "traceId">,
  instance: string
): Response {
  return withHeaders(
    problemResponse(429, "Too Many Requests", error.message, {
      type: ABUSE_PROBLEM_TYPES.quotaExceeded,
      instance,
      code: error.code,
      "violated-policies": [error.policy],
      retryAfterSeconds: error.retryAfterSeconds,
      reference: requestContext.traceId,
    }),
    rateLimitedHeaders(error.policy, error.retryAfterSeconds)
  );
}

/**
 * Counts the request against `policy`; returns `respond(error)` when the policy refuses
 * it, else null.
 */
export async function refuseOverLimit(
  deps: { readonly rateLimiter: RateLimiter },
  policy: RateLimitPolicyId,
  subject: LimitSubject,
  respond: (error: RateLimitedError) => Response
): Promise<Response | null> {
  try {
    await enforceRateLimit(deps, { policy, subject });
    return null;
  } catch (error) {
    if (error instanceof RateLimitedError) return respond(error);
    throw error;
  }
}

const HUMAN_CHECK_PROBLEMS: Readonly<
  Record<string, { readonly type: string; readonly title: string }>
> = {
  [HumanCheckFailedError.CODE]: {
    type: ABUSE_PROBLEM_TYPES.humanCheckFailed,
    title: "Human check failed",
  },
  [HumanCheckUnavailableError.CODE]: {
    type: ABUSE_PROBLEM_TYPES.humanCheckUnavailable,
    title: "Human check unavailable",
  },
};

/**
 * Better Auth's answer in the app's HTTP conventions: its 429s and the human-check
 * refusals become Problem Details, and every answer names the quotas that applied
 * (RateLimit-Policy). Other errors keep Better Auth's format, which its client reads.
 */
export async function betterAuthResponse(
  request: Request,
  response: Response,
  requestContext: Pick<RequestContext, "traceId">,
  authBasePath: string
): Promise<Response> {
  const instance = new URL(request.url).pathname;
  const authPolicy = authPathPolicy(instance.slice(authBasePath.length));
  const policies: RateLimitPolicyId[] = authPolicy
    ? ["auth.ip", authPolicy]
    : ["auth.ip"];

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("x-retry-after")) || 60;
    return rateLimitedResponse(
      new RateLimitedError(authPolicy ?? "auth.ip", retryAfter),
      requestContext,
      instance
    );
  }

  if (
    (response.status === 400 || response.status === 503) &&
    response.headers.get("content-type")?.includes("json")
  ) {
    const body = (await response
      .clone()
      .json()
      .catch(() => null)) as { code?: string; message?: string } | null;
    const problem = body?.code ? HUMAN_CHECK_PROBLEMS[body.code] : undefined;
    if (problem && body) {
      return withHeaders(
        problemResponse(response.status, problem.title, body.message ?? "", {
          type: problem.type,
          instance,
          code: body.code,
          reference: requestContext.traceId,
        }),
        { "RateLimit-Policy": rateLimitPolicyHeader(policies) }
      );
    }
  }

  return withHeaders(response, {
    "RateLimit-Policy": rateLimitPolicyHeader(policies),
  });
}
