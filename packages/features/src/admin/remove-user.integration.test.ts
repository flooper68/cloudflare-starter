import { describe, expect, it } from "vitest";

import { adminDeps, seedAccount, userAudit } from "../../test/admin-fixtures";
import {
  addMember,
  auditTrail,
  rows,
  seedWorkspace,
} from "../../test/fixtures";
import { LastOwnerError } from "../workspaces";
import { LastAdminError, SelfActionError } from "./domain";
import { removeUser } from "./remove-user";

function purger() {
  const purged: string[][] = [];
  return {
    purged,
    purgeWorkspaceFiles: async (ids: readonly string[]) => {
      purged.push([...ids]);
    },
  };
}

describe("removeUser", () => {
  it("deletes the account, its own workspaces and memberships, recorded as the admin", async () => {
    const admin = await seedAccount("Ada Admin", { role: "admin" });
    const grace = await seedAccount("Grace Hopper");
    const alan = await seedAccount("Alan Turing");
    await seedWorkspace(grace.id, { id: "ws-grace", kind: "personal" });
    await seedWorkspace(alan.id, { id: "ws-team" });
    await addMember("ws-team", grace.id);
    const files = purger();
    const deps = { ...adminDeps(), ...files };

    expect(
      await removeUser(deps, { userId: admin.id }, { userId: grace.id })
    ).toEqual({
      userId: grace.id,
      deletedWorkspaceIds: ["ws-grace"],
      leftWorkspaceIds: ["ws-team"],
    });
    expect(files.purged).toEqual([["ws-grace"]]);
    expect(deps.gateway.calls).toEqual([
      { op: "deleteUser", userId: grace.id },
    ]);
    expect(await rows("SELECT id FROM user WHERE id = ?", grace.id)).toEqual(
      []
    );
    expect(await userAudit(grace.id)).toMatchObject([
      // workspace.member_left in ws-team, then the deletion itself.
      { action: "workspace.member_left", actorKind: "admin", actor: admin.id },
      { action: "user.deleted", actorKind: "admin", actor: admin.id },
    ]);
    expect(await auditTrail("ws-grace")).toMatchObject([
      { action: "workspace.deleted", actor: admin.id },
    ]);
  });

  it("refuses the last owner of a shared workspace until an owner is assigned", async () => {
    const admin = await seedAccount("Ada Admin1", { role: "admin" });
    const owner = await seedAccount("Olga Owner1");
    const member = await seedAccount("Mia Member1");
    await seedWorkspace(owner.id, { id: "ws-shared1" });
    await addMember("ws-shared1", member.id);
    const deps = { ...adminDeps(), ...purger() };

    await expect(
      removeUser(deps, { userId: admin.id }, { userId: owner.id })
    ).rejects.toThrow(LastOwnerError);
    expect(deps.gateway.calls).toEqual([]);
    expect(
      await rows("SELECT id FROM user WHERE id = ?", owner.id)
    ).toHaveLength(1);
  });

  it("refuses yourself and the last active admin", async () => {
    await rows("UPDATE user SET role = 'user'");
    const admin = await seedAccount("Ada Admin2", { role: "admin" });
    const suspended = await seedAccount("Sam Suspended2", {
      role: "admin",
      banned: true,
    });
    const deps = { ...adminDeps(), ...purger() };
    await expect(
      removeUser(deps, { userId: admin.id }, { userId: admin.id })
    ).rejects.toThrow(SelfActionError);
    await expect(
      removeUser(deps, { userId: suspended.id }, { userId: admin.id })
    ).rejects.toThrow(LastAdminError);
  });
});
