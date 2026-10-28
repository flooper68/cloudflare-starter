import { describe, expect, it } from "vitest";

import { InvalidTrashInputError } from "./errors";
import { daysUntilPurge, trashPurgeAt, trashPurgeCutoff } from "./retention";

const DELETED = new Date("2026-10-01T09:30:00.000Z");

describe("trash retention", () => {
  it("purges retentionDays after the item was trashed", () => {
    expect(trashPurgeAt(DELETED, 30).toISOString()).toBe(
      "2026-10-31T09:30:00.000Z"
    );
  });

  it("the cutoff is retentionDays before now; an item trashed exactly then is due", () => {
    const now = new Date("2026-10-31T09:30:00.000Z");
    const cutoff = trashPurgeCutoff(now, 30);
    expect(cutoff.toISOString()).toBe(DELETED.toISOString());
    expect(trashPurgeAt(DELETED, 30).getTime()).toBeLessThanOrEqual(
      now.getTime()
    );
  });

  it("counts whole days left, rounded up, and 0 once due", () => {
    expect(daysUntilPurge(DELETED, 30, DELETED)).toBe(30);
    expect(
      daysUntilPurge(DELETED, 30, new Date("2026-10-30T09:30:00.001Z"))
    ).toBe(1);
    expect(
      daysUntilPurge(DELETED, 30, new Date("2026-10-31T09:30:00.000Z"))
    ).toBe(0);
    expect(
      daysUntilPurge(DELETED, 30, new Date("2026-12-01T00:00:00.000Z"))
    ).toBe(0);
  });

  it("refuses a retention that is not a whole number of days, at least 1", () => {
    for (const days of [0, -1, 1.5, Number.NaN]) {
      expect(() => trashPurgeAt(DELETED, days)).toThrow(InvalidTrashInputError);
      expect(() => trashPurgeCutoff(DELETED, days)).toThrow(
        InvalidTrashInputError
      );
    }
  });
});
