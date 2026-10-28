import type { Clock } from "../../../kernel";
import type { RateLimiter, RateLimitResult, RateLimitRule } from "../../ports";

/**
 * RateLimiter in memory, for tests and tools: fixed windows aligned to the clock (like
 * Workers Rate Limiting), exact counts, one process only. Retry-after is the time left
 * in the current window.
 */
export function createMemoryRateLimiter(clock: Clock): RateLimiter {
  const windows = new Map<string, { epoch: number; count: number }>();

  return {
    async limit(rule: RateLimitRule, key: string): Promise<RateLimitResult> {
      const periodMs = rule.periodSeconds * 1000;
      const now = clock.now().getTime();
      const epoch = Math.floor(now / periodMs);
      const counter = `${rule.periodSeconds}:${key}`;
      const current = windows.get(counter);
      const count = current?.epoch === epoch ? current.count : 0;

      if (count >= rule.limit) {
        const endsAt = (epoch + 1) * periodMs;
        return {
          ok: false,
          retryAfterSeconds: Math.max(1, Math.ceil((endsAt - now) / 1000)),
        };
      }
      windows.set(counter, { epoch, count: count + 1 });
      return { ok: true };
    },
  };
}
