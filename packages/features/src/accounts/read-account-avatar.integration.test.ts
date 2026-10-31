import { describe, expect, it } from "vitest";
import { seedUser } from "../../test/fixtures";
import { png, profileDeps } from "../../test/profile-fixtures";
import { readAccountAvatar } from "./read-account-avatar";
import { setAccountAvatar } from "./set-account-avatar";

describe("readAccountAvatar", () => {
  it("preserves ownership and the settings contract", async () => {
    const user = await seedUser();
    const other = await seedUser("Other Person");
    const deps = profileDeps();
    const result = await setAccountAvatar(deps, {
      userId: user.id,
      bytes: png,
      contentType: "image/png",
    });
    const version = result.avatarUrl.split("/").at(-1) as string;
    const image = await readAccountAvatar(deps, { userId: user.id, version });
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(png);
    await expect(
      readAccountAvatar(deps, { userId: other.id, version })
    ).rejects.toMatchObject({ kind: "not_found" });
    await expect(
      readAccountAvatar(deps, { userId: user.id, version: "../../other" })
    ).rejects.toThrow();
  });
});
