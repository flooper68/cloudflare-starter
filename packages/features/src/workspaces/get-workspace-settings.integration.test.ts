import { describe, expect, it } from "vitest";
import { seedUser, seedWorkspace } from "../../test/fixtures";
import { profileDeps } from "../../test/profile-fixtures";
import { getWorkspaceSettings } from "./get-workspace-settings";

describe("getWorkspaceSettings", () => {
  it("preserves ownership and the settings contract", async () => {
    const user = await seedUser();
    const actor = await seedWorkspace(user.id);
    expect(await getWorkspaceSettings(profileDeps(), actor)).toMatchObject({
      id: actor.workspaceId,
      name: "Acme Robotics",
      logoUrl: null,
    });
    await expect(
      getWorkspaceSettings(profileDeps(), { ...actor, workspaceId: "missing" })
    ).rejects.toThrow();
  });
});
