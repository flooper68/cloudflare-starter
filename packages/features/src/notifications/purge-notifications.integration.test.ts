import { describe, expect, it } from "vitest";

import {
  fixedClock,
  rows,
  seedNotification,
  seedUser,
  testDb,
} from "../../test/fixtures";
import { purgeNotifications } from "./purge-notifications";

describe("purgeNotifications", () => {
  it("deletes read or archived rows after 90 days and any row after 365", async () => {
    const grace = await seedUser("Grace Hopper", "grace.purge@example.test");
    const day = (iso: string) => `${iso}T00:00:00.000Z`;
    await seedNotification(grace.id, {
      id: "old-read",
      createdAt: day("2026-07-01"),
      readAt: day("2026-07-02"),
    });
    await seedNotification(grace.id, {
      id: "old-archived",
      createdAt: day("2026-07-01"),
      archivedAt: day("2026-07-02"),
    });
    await seedNotification(grace.id, {
      id: "old-unread",
      createdAt: day("2026-07-01"),
    });
    await seedNotification(grace.id, {
      id: "ancient",
      createdAt: day("2025-10-01"),
    });
    await seedNotification(grace.id, {
      id: "recent-read",
      createdAt: day("2026-10-01"),
      readAt: day("2026-10-02"),
    });

    expect(
      await purgeNotifications({
        db: testDb(),
        clock: fixedClock("2026-10-28T03:17:00.000Z"),
      })
    ).toEqual({ deleted: 3 });
    expect(
      await rows(
        "SELECT id FROM notifications WHERE user_id = ? ORDER BY id",
        grace.id
      )
    ).toEqual([{ id: "old-unread" }, { id: "recent-read" }]);
  });
});
