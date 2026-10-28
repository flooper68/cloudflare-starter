import type { RateLimiter, RateLimitResult, RateLimitRule } from "../../ports";

/**
 * RateLimiter on Workers Rate Limiting bindings (`ratelimits` in wrangler.jsonc). Each
 * rule names its binding; the binding holds the limit and period, so they must match
 * the catalog (test/architecture/abuse.test.ts). Counts are per Cloudflare location
 * and approximate. The binding does not say when the window resets, so a refusal asks
 * the caller to wait one full period.
 */
export function createCloudflareRateLimiter(
  bindings: Readonly<Record<string, RateLimit | undefined>>
): RateLimiter {
  return {
    async limit(rule: RateLimitRule, key: string): Promise<RateLimitResult> {
      if (!rule.binding) {
        throw new Error("This rate-limit rule has no binding to enforce it");
      }
      const binding = bindings[rule.binding];
      if (!binding) {
        throw new Error(
          `Missing Workers Rate Limiting binding ${rule.binding} (apps/web/wrangler.jsonc)`
        );
      }
      const { success } = await binding.limit({ key });
      return success
        ? { ok: true }
        : { ok: false, retryAfterSeconds: rule.periodSeconds };
    },
  };
}
