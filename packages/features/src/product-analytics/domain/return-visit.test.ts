import { describe, expect, it } from "vitest";

import { utcDaysBetween } from "./return-visit";

describe("utcDaysBetween", () => {
  it("counts UTC calendar days, not 24-hour spans", () => {
    expect(
      utcDaysBetween(
        new Date("2026-11-08T23:50:00Z"),
        new Date("2026-11-09T00:10:00Z")
      )
    ).toBe(1);
    expect(
      utcDaysBetween(
        new Date("2026-11-08T00:10:00Z"),
        new Date("2026-11-08T23:50:00Z")
      )
    ).toBe(0);
    expect(
      utcDaysBetween(
        new Date("2026-11-01T12:00:00Z"),
        new Date("2026-11-09T08:00:00Z")
      )
    ).toBe(8);
  });
});
