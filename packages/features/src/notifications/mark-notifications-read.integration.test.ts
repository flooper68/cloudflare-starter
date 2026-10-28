import { describe, expect, it } from "vitest";

import {
  fixedClock,
  rows,
  seedNotification,
  seedUser,
  seedWorkspace,
  testDb,
} from "../../test/fixtures";
import { markNotificationsRead } from "./mark-notifications-read";

const deps = () => ({ db: testDb(), clock: fixedClock() });
const NOW = Date.parse("2026-10-28T12:00:00.000Z");

describe("markNotificationsRead", () => {
  it("marks the given ids of the recipient only; others' ids are ignored", async () => {
    const grace = await seedUser("Grace Hopper", "grace.read@example.test");
    const alan = await seedUser("Alan Turing", "alan.read@example.test");
    await seedNotification(grace.id, { id: "r-1" });
    await seedNotification(grace.id, { id: "r-2" });
    await seedNotification(alan.id, { id: "r-3" });

    expect(
      await markNotificationsRead(deps(), {
        userId: grace.id,
        ids: ["r-1", "r-3"],
      })
    ).toEqual({ updated: 1 });
    expect(
      await rows(
        "SELECT id, read_at FROM notifications WHERE id LIKE 'r-%' ORDER BY id"
      )
    ).toEqual([
      { id: "r-1", read_at: NOW },
      { id: "r-2", read_at: null },
      { id: "r-3", read_at: null },
    ]);
  });

  it("marks all, or all of one workspace", async () => {
    const ada = await seedUser("Ada Lovelace", "ada.read@example.test");
    await seedWorkspace(ada.id, { id: "ws-read-a" });
    await seedWorkspace(ada.id, { id: "ws-read-b", name: "Other" });
    await seedNotification(ada.id, { id: "a-1", workspaceId: "ws-read-a" });
    await seedNotification(ada.id, { id: "a-2", workspaceId: "ws-read-b" });
    await seedNotification(ada.id, { id: "a-3", workspaceId: null });

    expect(
      await markNotificationsRead(deps(), {
        userId: ada.id,
        all: true,
        workspaceId: "ws-read-a",
      })
    ).toEqual({ updated: 1 });
    expect(
      await markNotificationsRead(deps(), { userId: ada.id, all: true })
    ).toEqual({ updated: 2 });
    expect(
      await rows(
        "SELECT count(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL",
        ada.id
      )
    ).toEqual([{ n: 0 }]);
  });
});
