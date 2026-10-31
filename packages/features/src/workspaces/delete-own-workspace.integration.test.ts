import { describe, expect, it } from "vitest";
import { rows, seedUser, seedWorkspace } from "../../test/fixtures";
import { profileDeps } from "../../test/profile-fixtures";
import { deleteOwnWorkspace } from "./delete-own-workspace";

describe("deleteOwnWorkspace", () => {
  it("preserves ownership and the settings contract", async () => {
    const user = await seedUser();
    const actor = await seedWorkspace(user.id);
    const purged: string[][] = [];
    const deps = {
      ...profileDeps(),
      purgeWorkspaceFiles: async (ids: readonly string[]) => {
        purged.push([...ids]);
      },
    };
    for (const input of [
      { mode: "single" as const, confirmName: "Acme Robotics" },
      { mode: "multi" as const, confirmName: "wrong" },
    ])
      await expect(deleteOwnWorkspace(deps, actor, input)).rejects.toThrow();
    expect(purged).toEqual([]);
    expect(
      await deleteOwnWorkspace(deps, actor, {
        mode: "multi",
        confirmName: "Acme Robotics",
      })
    ).toEqual({ deleted: true });
    expect(purged).toEqual([[actor.workspaceId]]);
    expect(
      await rows("SELECT id FROM workspaces WHERE id = ?", actor.workspaceId)
    ).toEqual([]);
    const personal = await seedWorkspace(user.id, {
      kind: "personal",
      name: "Personal",
    });
    await expect(
      deleteOwnWorkspace(deps, personal, {
        mode: "multi",
        confirmName: "Personal",
      })
    ).rejects.toMatchObject({ code: "WORKSPACE_DELETE_REFUSED" });
  });
});
