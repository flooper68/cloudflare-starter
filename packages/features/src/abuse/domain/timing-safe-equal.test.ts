import { describe, expect, it } from "vitest";

import { timingSafeEqual } from "./timing-safe-equal";

describe("timingSafeEqual", () => {
  const secret = "qa-token-0123456789abcdefghijklmnopqrstuv";

  it("accepts the same secret", () => {
    expect(timingSafeEqual(secret, secret)).toBe(true);
    expect(timingSafeEqual("ünïcode-✓", "ünïcode-✓")).toBe(true);
  });

  it.each([
    ["one character off at the end", `${secret.slice(0, -1)}x`],
    ["one character off at the start", `x${secret.slice(1)}`],
    ["a prefix", secret.slice(0, 10)],
    ["longer", `${secret}x`],
    ["empty", ""],
    ["the same bytes padded with NUL", `${secret}\u0000`],
  ])("refuses %s", (_, presented) => {
    expect(timingSafeEqual(presented, secret)).toBe(false);
  });

  it("never accepts an empty expected secret", () => {
    expect(timingSafeEqual("", "")).toBe(false);
  });
});
