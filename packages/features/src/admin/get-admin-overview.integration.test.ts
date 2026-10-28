import { describe, expect, it } from "vitest";

import { NOW, seedAccount, seedSession } from "../../test/admin-fixtures";
import {
  addMember,
  fixedClock,
  seedWorkspace,
  testDb,
} from "../../test/fixtures";
import { OVERVIEW_DAYS } from "./domain";
import { getAdminOverview } from "./get-admin-overview";

const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 24 * 3600 * 1000);

describe("getAdminOverview", () => {
  it("counts users, daily sign-ups and active users, and workspaces from D1", async () => {
    const ada = await seedAccount("Ada Admin", {
      role: "admin",
      createdAt: daysAgo(0),
    });
    const grace = await seedAccount("Grace Hopper", {
      banned: true,
      createdAt: daysAgo(0),
    });
    const alan = await seedAccount("Alan Turing", { createdAt: daysAgo(2) });
    await seedAccount("Old Timer", { createdAt: daysAgo(400) });
    await seedSession(ada.id, { minutesAgo: 5 });
    await seedSession(ada.id, { minutesAgo: 10 });
    await seedSession(alan.id, { minutesAgo: 20 });
    await seedSession(grace.id, { minutesAgo: 1, impersonatedBy: ada.id });
    await seedWorkspace(ada.id, { id: "ws-ada", kind: "personal" });
    await seedWorkspace(ada.id, { id: "ws-team" });
    await addMember("ws-team", alan.id);
    await seedWorkspace(alan.id, { id: "ws-solo" });

    const overview = await getAdminOverview(
      { db: testDb(), clock: fixedClock(NOW.toISOString()) },
      { userId: ada.id }
    );
    expect(overview.users).toEqual({ total: 4, admins: 1, banned: 1 });
    expect(overview.signUps).toHaveLength(OVERVIEW_DAYS);
    expect(overview.signUps.at(-1)).toEqual({ date: "2026-10-28", count: 2 });
    expect(overview.signUps.at(-3)).toEqual({ date: "2026-10-26", count: 1 });
    expect(overview.signUps.reduce((sum, d) => sum + d.count, 0)).toBe(3);
    expect(overview.activeUsers.at(-1)).toEqual({
      date: "2026-10-28",
      count: 2,
    });
    expect(overview.workspaces).toEqual({
      total: 3,
      shared: 2,
      personal: 1,
      sizes: [
        { label: "1 member", count: 1 },
        { label: "2–5 members", count: 1 },
        { label: "6–20 members", count: 0 },
        { label: "21+ members", count: 0 },
      ],
    });
    expect(overview.plans).toBeNull();
    expect(overview.usage).toBeNull();
  });
});
