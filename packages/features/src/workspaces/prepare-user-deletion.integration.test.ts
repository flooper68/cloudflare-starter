import { describe, expect, it } from "vitest";

import {
  addMember,
  auditTrail,
  rows,
  seedUser,
  seedWorkspace,
  useCaseDeps,
} from "../../test/fixtures";
import { prepareUserDeletion } from "./prepare-user-deletion";

function recorder() {
  const purged: string[][] = [];
  return {
    purged,
    purge: async (ids: readonly string[]) => {
      purged.push([...ids].sort());
    },
  };
}

describe("prepareUserDeletion", () => {
  it("personal mode: deletes the user's personal workspace and its data", async () => {
    const ada = await seedUser("Ada Lovelace0");
    await seedWorkspace(ada.id, { id: "ws-p0", kind: "personal" });
    const { purged, purge } = recorder();

    expect(
      await prepareUserDeletion(
        { ...useCaseDeps(), purgeWorkspaceFiles: purge },
        { userId: ada.id }
      )
    ).toEqual({ deletedWorkspaceIds: ["ws-p0"], leftWorkspaceIds: [] });
    expect(purged).toEqual([["ws-p0"]]);
    expect(await rows("SELECT id FROM workspaces")).toEqual([]);
  });

  it("multi or single mode: leaves shared workspaces, deletes ones nobody else uses", async () => {
    const ada = await seedUser("Ada Lovelace1");
    const grace = await seedUser("Grace Hopper1");
    await seedWorkspace(ada.id, { id: "ws-p1", kind: "personal" });
    await seedWorkspace(ada.id, { id: "ws-solo1" });
    await seedWorkspace(grace.id, { id: "ws-team1" });
    await addMember("ws-team1", ada.id);
    const { purged, purge } = recorder();

    expect(
      await prepareUserDeletion(
        { ...useCaseDeps(), purgeWorkspaceFiles: purge },
        { userId: ada.id }
      )
    ).toEqual({
      deletedWorkspaceIds: ["ws-p1", "ws-solo1"],
      leftWorkspaceIds: ["ws-team1"],
    });
    expect(purged).toEqual([["ws-p1", "ws-solo1"]]);
    expect((await auditTrail("ws-p1")).map((e) => e.action)).toEqual([
      "workspace.deleted",
    ]);
    expect((await auditTrail("ws-team1")).map((e) => e.action)).toEqual([
      "workspace.member_left",
    ]);
    expect(await rows("SELECT id FROM workspaces")).toEqual([
      { id: "ws-team1" },
    ]);
    expect(await rows("SELECT user_id FROM workspace_members")).toEqual([
      { user_id: grace.id },
    ]);
  });

  it("refuses, before changing anything, when the user is the last owner of a workspace others use", async () => {
    const ada = await seedUser("Ada Lovelace2");
    const grace = await seedUser("Grace Hopper2");
    await seedWorkspace(ada.id, { id: "ws-p2", kind: "personal" });
    await seedWorkspace(ada.id, { id: "ws-team2" });
    await addMember("ws-team2", grace.id);
    const { purged, purge } = recorder();

    await expect(
      prepareUserDeletion(
        { ...useCaseDeps(), purgeWorkspaceFiles: purge },
        { userId: ada.id }
      )
    ).rejects.toMatchObject({ name: "LastOwnerError" });
    expect(purged).toEqual([]);
    expect(
      await rows("SELECT id FROM workspaces WHERE id LIKE '%2' ORDER BY id")
    ).toEqual([{ id: "ws-p2" }, { id: "ws-team2" }]);
  });
});
