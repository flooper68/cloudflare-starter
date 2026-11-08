/**
 * Contract every PiComputer adapter passes. Each adapter has a `*.contract.test.ts` that
 * calls this suite.
 */
import { describe, expect, it } from "vitest";

import { type PiComputer, PiComputerError } from "./pi-computer";

/** Pi to 50 decimals, for checking any adapter's digits. */
export const PI_50 = "3.14159265358979323846264338327950288419716939937510";

export interface PiComputerHarness {
  readonly computer: PiComputer;
}

export function describePiComputerContract(
  name: string,
  makeHarness: () => PiComputerHarness | Promise<PiComputerHarness>
): void {
  describe(`PiComputer contract: ${name}`, () => {
    it("warms an instance", async () => {
      const { computer } = await makeHarness();
      await expect(computer.warm(0)).resolves.toBeUndefined();
    });

    it("computes pi with the asked number of decimals", async () => {
      const { computer } = await makeHarness();
      const result = await computer.compute(50, 1);
      expect(result.pi).toBe(PI_50);
      expect(result.digits).toBe(50);
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    });

    it("computes a thousand decimals ending in the known digits", async () => {
      const { computer } = await makeHarness();
      const result = await computer.compute(1000, 0);
      expect(result.pi).toHaveLength(1002);
      expect(result.pi.startsWith(PI_50)).toBe(true);
      expect(result.pi.endsWith("9092164201989")).toBe(true);
    });

    it("refuses digits out of range with PiComputerError failed", async () => {
      const { computer } = await makeHarness();
      for (const digits of [0, 100_001, 1.5]) {
        const error = await computer.compute(digits, 0).catch((e) => e);
        expect(error).toBeInstanceOf(PiComputerError);
        expect(error.failure).toBe("failed");
      }
    });
  });
}
