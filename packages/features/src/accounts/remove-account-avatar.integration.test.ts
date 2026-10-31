import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { seedUser } from "../../test/fixtures";
import { png, profileDeps } from "../../test/profile-fixtures";
import { getAccountSettings } from "./get-account-settings";
import { removeAccountAvatar } from "./remove-account-avatar";
import { setAccountAvatar } from "./set-account-avatar";

describe("removeAccountAvatar", () => {
  it("preserves ownership and the settings contract", async () => {
    const user = await seedUser();
    const deps = profileDeps();
    await setAccountAvatar(deps, {
      userId: user.id,
      bytes: png,
      contentType: "image/png",
    });
    expect(await removeAccountAvatar(deps, { userId: user.id })).toEqual({
      removed: true,
    });
    expect(
      (await getAccountSettings(deps, { userId: user.id })).avatarUrl
    ).toBeNull();
    expect(
      (await env.FILES.list({ prefix: `users/${user.id}/avatar/` })).objects
    ).toHaveLength(0);
  });
});
