import type { RateLimiter } from "../../ports";

/** RateLimiter that never limits (RATE_LIMITING=none). */
export const noopRateLimiter: RateLimiter = {
  limit: async () => ({ ok: true }),
};
