import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { seedUser, seedWorkspace } from "../../test/fixtures";
import { png, profileDeps } from "../../test/profile-fixtures";
import { getWorkspaceSettings } from "./get-workspace-settings";
import { removeWorkspaceLogo } from "./remove-workspace-logo";
import { setWorkspaceLogo } from "./set-workspace-logo";

describe("removeWorkspaceLogo", () => {
  it("preserves ownership and the settings contract", async () => {
    const actor = await seedWorkspace((await seedUser()).id);
    const deps = profileDeps();
    await setWorkspaceLogo(deps, actor, {
      bytes: png,
      contentType: "image/png",
    });
    await expect(
      removeWorkspaceLogo(deps, { ...actor, role: "member" })
    ).rejects.toThrow();
    await removeWorkspaceLogo(deps, actor);
    expect((await getWorkspaceSettings(deps, actor)).logoUrl).toBeNull();
    expect(
      (
        await env.FILES.list({
          prefix: `workspaces/${actor.workspaceId}/logo/`,
        })
      ).objects
    ).toHaveLength(0);
  });
});
