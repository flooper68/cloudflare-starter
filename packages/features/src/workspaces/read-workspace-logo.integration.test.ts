import { describe, expect, it } from "vitest";
import { seedUser, seedWorkspace } from "../../test/fixtures";
import { png, profileDeps } from "../../test/profile-fixtures";
import { readWorkspaceLogo } from "./read-workspace-logo";
import { setWorkspaceLogo } from "./set-workspace-logo";

describe("readWorkspaceLogo", () => {
  it("preserves ownership and the settings contract", async () => {
    const actor = await seedWorkspace((await seedUser()).id);
    const other = await seedWorkspace((await seedUser("Other Person")).id);
    const deps = profileDeps();
    const result = await setWorkspaceLogo(deps, actor, {
      bytes: png,
      contentType: "image/png",
    });
    const version = result.logoUrl?.split("/").at(-1) as string;
    expect(
      new Uint8Array(
        await (await readWorkspaceLogo(deps, actor, { version })).arrayBuffer()
      )
    ).toEqual(png);
    await expect(
      readWorkspaceLogo(deps, other, { version })
    ).rejects.toMatchObject({ kind: "not_found" });
  });
});
