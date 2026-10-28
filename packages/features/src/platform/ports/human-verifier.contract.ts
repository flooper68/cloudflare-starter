/**
 * Contract every HumanVerifier adapter passes. Each adapter has a `*.contract.test.ts`
 * that calls this suite.
 */
import { describe, expect, it } from "vitest";

import type { HumanVerifier } from "./human-verifier";

export interface HumanVerifierHarness {
  readonly verifier: HumanVerifier;
  /** A token the adapter accepts. */
  readonly passToken: string;
  /** A token the adapter refuses (ignored when `enforces` is false). */
  readonly failToken: string;
  /** False for adapters that pass everyone (noop). */
  readonly enforces: boolean;
}

const input = (token: string | null) => ({
  token,
  remoteIp: "203.0.113.7",
  action: "sign-up",
});

export function describeHumanVerifierContract(
  name: string,
  makeHarness: () => HumanVerifierHarness | Promise<HumanVerifierHarness>
): void {
  describe(`HumanVerifier contract: ${name}`, () => {
    it("accepts a valid token", async () => {
      const harness = await makeHarness();
      expect(await harness.verifier.verify(input(harness.passToken))).toEqual({
        ok: true,
      });
    });

    it("refuses a request without a token", async () => {
      const harness = await makeHarness();
      const result = await harness.verifier.verify(input(null));
      expect(result).toEqual(
        harness.enforces ? { ok: false, reason: "missing" } : { ok: true }
      );
    });

    it("refuses an invalid token", async () => {
      const harness = await makeHarness();
      const result = await harness.verifier.verify(input(harness.failToken));
      expect(result).toEqual(
        harness.enforces ? { ok: false, reason: "rejected" } : { ok: true }
      );
    });
  });
}
