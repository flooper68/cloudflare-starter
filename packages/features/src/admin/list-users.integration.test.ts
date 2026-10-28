import { describe, expect, it } from "vitest";

import { NOW, seedAccount, seedSession } from "../../test/admin-fixtures";
import { fixedClock, testDb } from "../../test/fixtures";
import { InvalidAdminQueryError } from "./domain";
import { listUsers } from "./list-users";

const deps = () => ({ db: testDb(), clock: fixedClock(NOW.toISOString()) });
const admin = { userId: "user-admin" };
const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 24 * 3600 * 1000);

describe("listUsers", () => {
  it("lists, searches, filters and pages through every user", async () => {
    const ada = await seedAccount("Ada Lovelace", {
      role: "admin",
      createdAt: daysAgo(5),
      verified: true,
    });
    const grace = await seedAccount("Grace Hopper", {
      banned: true,
      createdAt: daysAgo(4),
    });
    const alan = await seedAccount("Alan Turing", { createdAt: daysAgo(3) });
    const lifted = await seedAccount("Lia 100%_Lifted", {
      banned: true,
      banExpires: daysAgo(1),
      createdAt: daysAgo(2),
    });
    await seedSession(alan.id, { minutesAgo: 10 });

    const all = await listUsers(deps(), admin);
    expect(all.items.map((row) => row.name)).toEqual([
      lifted.name,
      alan.name,
      grace.name,
      ada.name,
    ]);
    expect(all.items[1]).toMatchObject({
      role: "user",
      banned: false,
      lastSeenAt: new Date(NOW.getTime() - 10 * 60 * 1000),
    });
    expect(all.items[3]).toMatchObject({ role: "admin", emailVerified: true });
    expect(all.items[0]?.banned).toBe(false);

    const ids = async (input: Parameters<typeof listUsers>[2]) =>
      (await listUsers(deps(), admin, input)).items.map((row) => row.id);
    expect(await ids({ search: "HOPPER" })).toEqual([grace.id]);
    expect(await ids({ search: "100%_" })).toEqual([lifted.id]);
    expect(await ids({ role: "admin" })).toEqual([ada.id]);
    expect(await ids({ role: "user" })).toEqual([lifted.id, alan.id, grace.id]);
    expect(await ids({ status: "banned" })).toEqual([grace.id]);
    expect(await ids({ status: "active" })).toEqual([
      lifted.id,
      alan.id,
      ada.id,
    ]);

    const first = await listUsers(deps(), admin, { limit: 3 });
    expect(first.items).toHaveLength(3);
    const second = await listUsers(deps(), admin, {
      limit: 3,
      cursor: first.nextCursor ?? "",
    });
    expect(second.items.map((row) => row.id)).toEqual([ada.id]);
    expect(second.nextCursor).toBeNull();
  });

  it("refuses a malformed query", async () => {
    await expect(
      listUsers(deps(), admin, { cursor: "not-a-cursor" })
    ).rejects.toThrow(InvalidAdminQueryError);
  });
});
