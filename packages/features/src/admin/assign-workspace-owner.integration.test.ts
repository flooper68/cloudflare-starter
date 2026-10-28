import { describe, expect, it } from "vitest";

import { adminDeps, seedAccount } from "../../test/admin-fixtures";
import {
  addMember,
  auditTrail,
  rows,
  seedWorkspace,
} from "../../test/fixtures";
import { WorkspaceModeError, WorkspaceNotFoundError } from "../workspaces";
import { assignWorkspaceOwner } from "./assign-workspace-owner";
import { AdminUserNotFoundError, WorkspaceHasOwnerError } from "./domain";
import { removeUser } from "./remove-user";

describe("assignWorkspaceOwner", () => {
  it("rescues a workspace whose last owner must go: assign, then the old owner can be removed", async () => {
    const admin = await seedAccount("Ada Admin", { role: "admin" });
    const owner = await seedAccount("Olga Owner");
    const member = await seedAccount("Mia Member");
    await seedWorkspace(owner.id, { id: "ws-team" });
    await addMember("ws-team", member.id);
    // The owner was demoted by a database fix gone wrong: nobody manages the workspace.
    await rows(
      "UPDATE workspace_members SET role = 'member' WHERE user_id = ?",
      owner.id
    );
    const deps = adminDeps();

    expect(
      await assignWorkspaceOwner(
        deps,
        { userId: admin.id },
        {
          workspaceId: "ws-team",
          userId: member.id,
          mode: "multi",
        }
      )
    ).toEqual({ workspaceId: "ws-team", userId: member.id });
    expect(
      await rows(
        "SELECT role FROM workspace_members WHERE workspace_id = 'ws-team' AND user_id = ?",
        member.id
      )
    ).toEqual([{ role: "owner" }]);
    expect(await auditTrail("ws-team")).toMatchObject([
      {
        action: "workspace.owner_assigned",
        actor: admin.id,
        target: `user:${member.id}`,
        metadata: { previousRole: "member" },
      },
    ]);

    // With a new owner, the old one is no longer the last: removal goes through.
    await removeUser(
      { ...deps, purgeWorkspaceFiles: async () => {} },
      { userId: admin.id },
      { userId: owner.id }
    );
    expect(
      await rows(
        "SELECT user_id FROM workspace_members WHERE workspace_id = 'ws-team'"
      )
    ).toEqual([{ user_id: member.id }]);
  });

  it("adds a non-member as owner; refuses while an owner exists", async () => {
    const admin = await seedAccount("Ada Admin1", { role: "admin" });
    const owner = await seedAccount("Olga Owner1");
    const outsider = await seedAccount("Oscar Outsider1");
    await seedWorkspace(owner.id, { id: "ws-1" });
    const deps = adminDeps();
    await expect(
      assignWorkspaceOwner(
        deps,
        { userId: admin.id },
        {
          workspaceId: "ws-1",
          userId: outsider.id,
          mode: "single",
        }
      )
    ).rejects.toThrow(WorkspaceHasOwnerError);

    await rows("DELETE FROM workspace_members WHERE workspace_id = 'ws-1'");
    await assignWorkspaceOwner(
      deps,
      { userId: admin.id },
      {
        workspaceId: "ws-1",
        userId: outsider.id,
        mode: "single",
      }
    );
    expect(await auditTrail("ws-1")).toMatchObject([
      { action: "workspace.owner_assigned", metadata: { previousRole: null } },
    ]);
  });

  it("refuses unknown workspaces and users, and personal mode", async () => {
    const admin = await seedAccount("Ada Admin2", { role: "admin" });
    const user = await seedAccount("Uma User2");
    await seedWorkspace(user.id, { id: "ws-2" });
    const deps = adminDeps();
    const assign = (input: {
      workspaceId: string;
      userId: string;
      mode: "multi" | "personal";
    }) => assignWorkspaceOwner(deps, { userId: admin.id }, input);
    await expect(
      assign({ workspaceId: "ws-none", userId: user.id, mode: "multi" })
    ).rejects.toThrow(WorkspaceNotFoundError);
    await expect(
      assign({ workspaceId: "ws-2", userId: "user-none", mode: "multi" })
    ).rejects.toThrow(AdminUserNotFoundError);
    await expect(
      assign({ workspaceId: "ws-2", userId: user.id, mode: "personal" })
    ).rejects.toThrow(WorkspaceModeError);
  });
});
