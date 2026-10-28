import { describe, expect, it } from "vitest";

import { NOW, seedAccount, seedSession } from "../../test/admin-fixtures";
import { fixedClock, testDb } from "../../test/fixtures";
import { findAdminAccess } from "./find-admin-access";

const deps = () => ({ db: testDb(), clock: fixedClock(NOW.toISOString()) });

describe("findAdminAccess", () => {
  it("an active admin, with their newest own sign-in (impersonations aside)", async () => {
    const ada = await seedAccount("Ada Admin", { role: "user,admin" });
    await seedSession(ada.id, { minutesAgo: 90 });
    await seedSession(ada.id, { minutesAgo: 30 });
    await seedSession(ada.id, { minutesAgo: 1, impersonatedBy: "user-other" });
    const access = await findAdminAccess(deps(), { userId: ada.id });
    expect(access.isAdmin).toBe(true);
    expect(access.lastSignInAt?.toISOString()).toBe("2026-10-28T11:30:00.000Z");
  });

  it("not for users, suspended admins or unknown ids; an expired suspension is lifted", async () => {
    const user = await seedAccount("Grace User");
    const suspended = await seedAccount("Sam Suspended", {
      role: "admin",
      banned: true,
    });
    const lifted = await seedAccount("Lia Lifted", {
      role: "admin",
      banned: true,
      banExpires: new Date(NOW.getTime() - 1000),
    });
    for (const userId of [user.id, suspended.id, "user-nobody"]) {
      expect(await findAdminAccess(deps(), { userId })).toEqual({
        isAdmin: false,
        lastSignInAt: null,
      });
    }
    expect(await findAdminAccess(deps(), { userId: lifted.id })).toEqual({
      isAdmin: true,
      lastSignInAt: null,
    });
  });
});
