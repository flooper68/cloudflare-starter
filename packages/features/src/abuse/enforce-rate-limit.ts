import type { RateLimiter } from "../platform";
import {
  type LimitSubject,
  limitKey,
  RATE_LIMIT_POLICIES,
  RateLimitedError,
  type RateLimitPolicyId,
} from "./domain";

/**
 * Counts one request of `subject` against an edge policy of the catalog and throws
 * RateLimitedError when the policy refuses it. Adapters (tRPC middleware, HTTP routes,
 * /mcp) call this before doing the work.
 */
export async function enforceRateLimit(
  deps: { readonly rateLimiter: RateLimiter },
  input: { readonly policy: RateLimitPolicyId; readonly subject: LimitSubject }
): Promise<void> {
  const result = await deps.rateLimiter.limit(
    RATE_LIMIT_POLICIES[input.policy],
    limitKey(input.policy, input.subject)
  );
  if (!result.ok) {
    throw new RateLimitedError(input.policy, result.retryAfterSeconds);
  }
}
