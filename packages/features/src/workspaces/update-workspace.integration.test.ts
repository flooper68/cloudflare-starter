import { describe, expect, it } from "vitest";
import {
  addMember,
  auditTrail,
  seedUser,
  seedWorkspace,
} from "../../test/fixtures";
import { profileDeps } from "../../test/profile-fixtures";
import { updateWorkspace } from "./update-workspace";

describe("updateWorkspace", () => {
  it("preserves ownership and the settings contract", async () => {
    const owner = await seedUser();
    const actor = await seedWorkspace(owner.id);
    const member = await addMember(
      actor.workspaceId,
      (await seedUser("Member Person")).id
    );
    await expect(
      updateWorkspace(profileDeps(), member, { name: "No" })
    ).rejects.toThrow();
    expect(
      await updateWorkspace(profileDeps(), actor, { name: "  New team  " })
    ).toMatchObject({ name: "New team" });
    expect(await auditTrail(actor.workspaceId)).toEqual([
      expect.objectContaining({ action: "workspace.updated" }),
    ]);
  });
});
