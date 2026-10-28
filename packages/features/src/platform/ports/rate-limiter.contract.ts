/**
 * Contract every RateLimiter adapter passes. Each adapter has a `*.contract.test.ts` (or
 * `.contract.integration.test.ts` when it needs workerd) that calls this suite.
 */
import { describe, expect, it } from "vitest";

import type { RateLimiter, RateLimitRule } from "./rate-limiter";

export interface RateLimiterHarness {
  readonly limiter: RateLimiter;
  /** A rule the adapter can enforce (cloudflare: one whose binding exists). */
  readonly rule: RateLimitRule;
  /** False for adapters that never limit (noop). */
  readonly enforces: boolean;
}

const uniqueKey = (label: string) => `${label}:${crypto.randomUUID()}`;

/** Calls until refused, at most enough to cross one window boundary. */
async function untilRefused(harness: RateLimiterHarness, key: string) {
  const cap = harness.rule.limit * 2 + 1;
  for (let call = 1; call <= cap; call++) {
    const result = await harness.limiter.limit(harness.rule, key);
    if (!result.ok) return { call, result };
  }
  return null;
}

export function describeRateLimiterContract(
  name: string,
  makeHarness: () => RateLimiterHarness | Promise<RateLimiterHarness>
): void {
  describe(`RateLimiter contract: ${name}`, () => {
    it("allows the first request for a key", async () => {
      const harness = await makeHarness();
      expect(
        await harness.limiter.limit(harness.rule, uniqueKey("first"))
      ).toEqual({ ok: true });
    });

    it("refuses once the limit is reached, saying how long to wait", async () => {
      const harness = await makeHarness();
      const refused = await untilRefused(harness, uniqueKey("limit"));
      if (!harness.enforces) {
        expect(refused).toBeNull();
        return;
      }
      expect(refused, "never refused").not.toBeNull();
      expect(refused?.call).toBeGreaterThan(harness.rule.limit);
      const wait =
        refused?.result.ok === false ? refused.result.retryAfterSeconds : 0;
      expect(wait).toBeGreaterThan(0);
      expect(wait).toBeLessThanOrEqual(harness.rule.periodSeconds);
    });

    it("counts each key on its own", async () => {
      const harness = await makeHarness();
      await untilRefused(harness, uniqueKey("busy"));
      expect(
        await harness.limiter.limit(harness.rule, uniqueKey("quiet"))
      ).toEqual({ ok: true });
    });
  });
}
