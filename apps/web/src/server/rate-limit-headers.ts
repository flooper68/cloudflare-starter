import {
  RATE_LIMIT_POLICIES,
  type RateLimitPolicyId,
} from "@cloudflare-starter/features";

/**
 * RateLimit header fields of draft-ietf-httpapi-ratelimit-headers-11 (Structured Field
 * Lists): `RateLimit-Policy: "<id>";q=<limit>;w=<period>` names the quotas that apply,
 * `RateLimit: "<id>";r=<remaining>;t=<seconds>` the state of one. Workers Rate Limiting
 * does not report what is left, so `RateLimit` is sent only on refusals (r=0).
 */
export function rateLimitPolicyHeader(
  ids: readonly RateLimitPolicyId[]
): string {
  return [...new Set(ids)]
    .map((id) => {
      const policy = RATE_LIMIT_POLICIES[id];
      return `"${id}";q=${policy.limit};w=${policy.periodSeconds}`;
    })
    .join(", ");
}

/** Headers of a 429: Retry-After plus the policy and its exhausted state. */
export function rateLimitedHeaders(
  id: RateLimitPolicyId,
  retryAfterSeconds: number
): Record<string, string> {
  return {
    "Retry-After": String(retryAfterSeconds),
    "RateLimit-Policy": rateLimitPolicyHeader([id]),
    RateLimit: `"${id}";r=0;t=${retryAfterSeconds}`,
  };
}
