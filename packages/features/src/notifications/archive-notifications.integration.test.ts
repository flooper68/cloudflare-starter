import { describe, expect, it } from "vitest";

import {
  fixedClock,
  rows,
  seedNotification,
  seedUser,
  testDb,
} from "../../test/fixtures";
import { archiveNotifications } from "./archive-notifications";
import { MAX_IDS } from "./domain";

const NOW = Date.parse("2026-10-28T12:00:00.000Z");
const EARLIER = "2026-10-28T11:30:00.000Z";

describe("archiveNotifications", () => {
  it("archives the recipient's rows and marks them read, keeping an earlier read time", async () => {
    const grace = await seedUser("Grace Hopper", "grace.archive@example.test");
    const alan = await seedUser("Alan Turing", "alan.archive@example.test");
    await seedNotification(grace.id, { id: "x-1" });
    await seedNotification(grace.id, { id: "x-2", readAt: EARLIER });
    await seedNotification(alan.id, { id: "x-3" });

    expect(
      await archiveNotifications(
        { db: testDb(), clock: fixedClock() },
        { userId: grace.id, ids: ["x-1", "x-2", "x-3"] }
      )
    ).toEqual({ updated: 2 });
    expect(
      await rows(
        "SELECT id, read_at, archived_at FROM notifications WHERE id LIKE 'x-%' ORDER BY id"
      )
    ).toEqual([
      { id: "x-1", read_at: NOW, archived_at: NOW },
      { id: "x-2", read_at: Date.parse(EARLIER), archived_at: NOW },
      { id: "x-3", read_at: null, archived_at: null },
    ]);
    // Archiving again changes nothing.
    expect(
      await archiveNotifications(
        { db: testDb(), clock: fixedClock() },
        { userId: grace.id, ids: ["x-1"] }
      )
    ).toEqual({ updated: 0 });
  });

  it("takes the most ids one call allows in one statement (D1's parameter limit)", async () => {
    const busy = await seedUser("Busy Person", "busy.archive@example.test");
    const ids = Array.from({ length: MAX_IDS }, (_, i) => `ax-${i}`);
    for (const id of ids) await seedNotification(busy.id, { id });
    expect(
      await archiveNotifications(
        { db: testDb(), clock: fixedClock() },
        { userId: busy.id, ids }
      )
    ).toEqual({ updated: MAX_IDS });
  });
});
