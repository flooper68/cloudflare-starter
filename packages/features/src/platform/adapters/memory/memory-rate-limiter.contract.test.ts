import { describe, expect, it } from "vitest";

import { describeRateLimiterContract } from "../../ports/rate-limiter.contract";
import { createMemoryRateLimiter } from "./memory-rate-limiter";

const fixedClock = (iso: string) => {
  let now = new Date(iso).getTime();
  return {
    now: () => new Date(now),
    advance: (seconds: number) => {
      now += seconds * 1000;
    },
  };
};

describeRateLimiterContract("memory", () => ({
  limiter: createMemoryRateLimiter(fixedClock("2026-10-28T12:00:05Z")),
  rule: { limit: 3, periodSeconds: 10 },
  enforces: true,
}));

describe("memory rate limiter", () => {
  const rule = { limit: 2, periodSeconds: 60 };

  it("says how long is left in the window and opens again after it", async () => {
    const clock = fixedClock("2026-10-28T12:00:15Z");
    const limiter = createMemoryRateLimiter(clock);
    await limiter.limit(rule, "k");
    await limiter.limit(rule, "k");
    expect(await limiter.limit(rule, "k")).toEqual({
      ok: false,
      retryAfterSeconds: 45,
    });
    clock.advance(45);
    expect(await limiter.limit(rule, "k")).toEqual({ ok: true });
  });
});
