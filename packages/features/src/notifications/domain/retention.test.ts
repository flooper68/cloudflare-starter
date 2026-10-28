import { describe, expect, it } from "vitest";

import {
  notificationRetentionCutoffs,
  READ_RETENTION_DAYS,
  UNREAD_RETENTION_DAYS,
} from "./retention";

describe("notificationRetentionCutoffs", () => {
  it("keeps read rows 90 days and unread rows 365 days", () => {
    expect(READ_RETENTION_DAYS).toBe(90);
    expect(UNREAD_RETENTION_DAYS).toBe(365);
    expect(
      notificationRetentionCutoffs(new Date("2026-10-28T03:17:00.000Z"))
    ).toEqual({
      readBefore: new Date("2026-07-30T03:17:00.000Z"),
      unreadBefore: new Date("2025-10-28T03:17:00.000Z"),
    });
  });
});
