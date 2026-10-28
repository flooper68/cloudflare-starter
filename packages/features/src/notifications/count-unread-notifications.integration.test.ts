import { describe, expect, it } from "vitest";

import { seedNotification, seedUser, testDb } from "../../test/fixtures";
import { countUnreadNotifications } from "./count-unread-notifications";

describe("countUnreadNotifications", () => {
  it("counts the user's unread, unarchived in-app rows", async () => {
    const grace = await seedUser("Grace Hopper", "grace.count@example.test");
    const alan = await seedUser("Alan Turing", "alan.count@example.test");
    await seedNotification(grace.id, { id: "c-1" });
    await seedNotification(grace.id, { id: "c-2" });
    await seedNotification(grace.id, {
      id: "c-3",
      readAt: "2026-10-28T11:30:00.000Z",
    });
    await seedNotification(grace.id, {
      id: "c-4",
      archivedAt: "2026-10-28T11:30:00.000Z",
    });
    await seedNotification(grace.id, { id: "c-5", inApp: false });
    await seedNotification(alan.id, { id: "c-6" });

    expect(
      await countUnreadNotifications({ db: testDb() }, { userId: grace.id })
    ).toEqual({ count: 2 });
  });

  it("caps the count at 100", async () => {
    const busy = await seedUser("Busy Person", "busy.count@example.test");
    for (let i = 0; i < 101; i++) {
      await seedNotification(busy.id, { id: `busy-${i}` });
    }
    expect(
      await countUnreadNotifications({ db: testDb() }, { userId: busy.id })
    ).toEqual({ count: 100 });
  });
});
