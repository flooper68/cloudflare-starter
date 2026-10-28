import { describe, expect, it } from "vitest";

import {
  dailySeries,
  utcDay,
  windowStart,
  workspaceSizeBuckets,
} from "./overview";

describe("admin overview", () => {
  it("starts the window at midnight UTC, days - 1 days before today", () => {
    const now = new Date("2026-10-28T23:59:00.000Z");
    expect(windowStart(now, 30).toISOString()).toBe("2026-09-29T00:00:00.000Z");
    expect(windowStart(now, 1).toISOString()).toBe("2026-10-28T00:00:00.000Z");
    expect(utcDay(now)).toBe("2026-10-28");
  });

  it("fills days without rows with zero, oldest first", () => {
    const start = new Date("2026-10-26T00:00:00.000Z");
    expect(
      dailySeries(start, 3, [
        { date: "2026-10-28", count: 4 },
        { date: "2026-10-26", count: 1 },
        { date: "2026-10-01", count: 9 },
      ])
    ).toEqual([
      { date: "2026-10-26", count: 1 },
      { date: "2026-10-27", count: 0 },
      { date: "2026-10-28", count: 4 },
    ]);
  });

  it("buckets workspaces by member count", () => {
    expect(workspaceSizeBuckets([1, 1, 2, 5, 6, 20, 21, 400, 0])).toEqual([
      { label: "1 member", count: 2 },
      { label: "2–5 members", count: 2 },
      { label: "6–20 members", count: 2 },
      { label: "21+ members", count: 2 },
    ]);
  });
});
