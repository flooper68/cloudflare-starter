import { describe, expect, it } from "vitest";

import { adminDeps, seedAccount, userAudit } from "../../test/admin-fixtures";
import { rows } from "../../test/fixtures";
import { LastAdminError, SelfActionError } from "./domain";
import { setUserRole } from "./set-user-role";

describe("setUserRole", () => {
  it("promotes and demotes, recording the previous role", async () => {
    const admin = await seedAccount("Ada Admin", { role: "admin" });
    const grace = await seedAccount("Grace Hopper", { role: null });
    const deps = adminDeps();

    await setUserRole(
      deps,
      { userId: admin.id },
      {
        userId: grace.id,
        role: "admin",
      }
    );
    await setUserRole(
      deps,
      { userId: admin.id },
      {
        userId: grace.id,
        role: "user",
      }
    );
    expect(await rows("SELECT role FROM user WHERE id = ?", grace.id)).toEqual([
      { role: "user" },
    ]);
    expect(await userAudit(grace.id)).toMatchObject([
      {
        action: "user.role_changed",
        actorKind: "admin",
        metadata: { previousRole: "user", role: "admin" },
      },
      {
        action: "user.role_changed",
        metadata: { previousRole: "admin", role: "user" },
      },
    ]);
  });

  it("changes nothing when the role is already set", async () => {
    const admin = await seedAccount("Ada Admin1", { role: "admin" });
    const alan = await seedAccount("Alan Turing1");
    const deps = adminDeps();
    await setUserRole(
      deps,
      { userId: admin.id },
      {
        userId: alan.id,
        role: "user",
      }
    );
    expect(deps.gateway.calls).toEqual([]);
  });

  it("refuses your own role and demoting the last active admin", async () => {
    await rows("UPDATE user SET role = 'user'");
    const admin = await seedAccount("Ada Admin2", { role: "admin" });
    const deps = adminDeps();
    await expect(
      setUserRole(
        deps,
        { userId: admin.id },
        { userId: admin.id, role: "user" }
      )
    ).rejects.toThrow(SelfActionError);

    // Another admin, but suspended: demoting Ada through them would leave no active admin.
    const suspended = await seedAccount("Sam Suspended2", {
      role: "admin",
      banned: true,
    });
    await expect(
      setUserRole(
        deps,
        { userId: suspended.id },
        {
          userId: admin.id,
          role: "user",
        }
      )
    ).rejects.toThrow(LastAdminError);
    expect(deps.gateway.calls).toEqual([]);
  });

  it("the only active admin may demote a suspended admin", async () => {
    await rows("UPDATE user SET role = 'user'");
    const admin = await seedAccount("Ada Admin3", { role: "admin" });
    const suspended = await seedAccount("Sam Suspended3", {
      role: "admin",
      banned: true,
    });
    const deps = adminDeps();
    await setUserRole(
      deps,
      { userId: admin.id },
      { userId: suspended.id, role: "user" }
    );
    expect(deps.gateway.calls).toEqual([
      { op: "setRole", userId: suspended.id, role: "user" },
    ]);
  });
});
