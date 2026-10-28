import { describe, expect, it } from "vitest";

import { adminDeps, seedAccount } from "../../test/admin-fixtures";
import {
  addMember,
  auditTrail,
  rows,
  seedWorkspace,
} from "../../test/fixtures";
import {
  PersonalWorkspaceError,
  WorkspaceModeError,
  WorkspaceNotFoundError,
} from "../workspaces";
import { deleteWorkspace } from "./delete-workspace";

describe("deleteWorkspace", () => {
  it("deletes a shared workspace with its files and members, recorded as the admin", async () => {
    const admin = await seedAccount("Ada Admin", { role: "admin" });
    const owner = await seedAccount("Olga Owner");
    const member = await seedAccount("Mia Member");
    await seedWorkspace(owner.id, { id: "ws-team" });
    await addMember("ws-team", member.id);
    const purged: string[][] = [];
    const deps = {
      ...adminDeps(),
      purgeWorkspaceFiles: async (ids: readonly string[]) => {
        purged.push([...ids]);
      },
    };

    expect(
      await deleteWorkspace(
        deps,
        { userId: admin.id },
        {
          workspaceId: "ws-team",
          mode: "multi",
        }
      )
    ).toEqual({ workspaceId: "ws-team" });
    expect(purged).toEqual([["ws-team"]]);
    expect(
      await rows("SELECT id FROM workspaces WHERE id = 'ws-team'")
    ).toEqual([]);
    expect(
      await rows(
        "SELECT user_id FROM workspace_members WHERE workspace_id = 'ws-team'"
      )
    ).toEqual([]);
    expect(await auditTrail("ws-team")).toMatchObject([
      { action: "workspace.deleted", actor: admin.id },
    ]);
  });

  it("refuses personal workspaces, unknown ones and personal mode", async () => {
    const admin = await seedAccount("Ada Admin1", { role: "admin" });
    await seedWorkspace(admin.id, { id: "ws-own", kind: "personal" });
    const deps = { ...adminDeps(), purgeWorkspaceFiles: async () => {} };
    const remove = (
      workspaceId: string,
      mode: "multi" | "personal" = "multi"
    ) => deleteWorkspace(deps, { userId: admin.id }, { workspaceId, mode });
    await expect(remove("ws-own")).rejects.toThrow(PersonalWorkspaceError);
    await expect(remove("ws-none")).rejects.toThrow(WorkspaceNotFoundError);
    await expect(remove("ws-own", "personal")).rejects.toThrow(
      WorkspaceModeError
    );
  });
});
