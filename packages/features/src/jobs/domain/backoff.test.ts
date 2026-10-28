import { describe, expect, it } from "vitest";

import type { JobBackoff } from "../../kernel";
import { retryDelaySeconds } from "./backoff";

const fixed = (value: number) => ({ next: () => value });
const none: JobBackoff = {
  initialDelaySeconds: 10,
  maxDelaySeconds: 600,
  jitter: "none",
};

describe("retryDelaySeconds", () => {
  it("doubles from the initial delay per attempt, then caps", () => {
    expect(
      [1, 2, 3, 4, 5, 6, 7, 8].map((attempts) =>
        retryDelaySeconds(none, attempts, fixed(0.5))
      )
    ).toEqual([10, 20, 40, 80, 160, 320, 600, 600]);
  });

  it("never exceeds the Queues limit of 24 hours", () => {
    expect(
      retryDelaySeconds(
        { initialDelaySeconds: 3600, maxDelaySeconds: 999_999, jitter: "none" },
        20,
        fixed(0)
      )
    ).toBe(86_400);
  });

  it("full jitter picks between 1 second and the delay", () => {
    const backoff = { ...none, jitter: "full" } as const;
    expect(retryDelaySeconds(backoff, 3, fixed(0))).toBe(1);
    expect(retryDelaySeconds(backoff, 3, fixed(0.5))).toBe(20);
    expect(retryDelaySeconds(backoff, 3, fixed(0.999))).toBe(40);
  });

  it("equal jitter picks between half the delay and the delay", () => {
    const backoff = { ...none, jitter: "equal" } as const;
    expect(retryDelaySeconds(backoff, 3, fixed(0))).toBe(20);
    expect(retryDelaySeconds(backoff, 3, fixed(0.999))).toBe(40);
  });

  it("always returns a whole number of at least 1", () => {
    for (const value of [0, 0.123, 0.77]) {
      const delay = retryDelaySeconds(
        { initialDelaySeconds: 1, maxDelaySeconds: 7, jitter: "full" },
        2,
        fixed(value)
      );
      expect(Number.isInteger(delay)).toBe(true);
      expect(delay).toBeGreaterThanOrEqual(1);
    }
  });
});
