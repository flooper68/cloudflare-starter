import { describe, expect, it } from "vitest";
import { seedUser } from "../../test/fixtures";
import { profileDeps } from "../../test/profile-fixtures";
import { getAccountSettings } from "./get-account-settings";
import { updateAccountSettings } from "./update-account-settings";
import { userSettings } from "./user-settings.schema";

describe("updateAccountSettings", () => {
  it("preserves ownership and the settings contract", async () => {
    const user = await seedUser();
    const other = await seedUser("Other Person");
    const deps = profileDeps();
    await deps.db
      .insert(userSettings)
      .values({ userId: user.id, avatarKey: `users/${user.id}/avatar/v1` });
    expect(
      await updateAccountSettings(deps, {
        userId: user.id,
        settings: {
          theme: "light",
          locale: "cs-CZ",
          timezone: "Europe/Prague",
        },
      })
    ).toMatchObject({ theme: "light", avatarUrl: "/api/account/avatar/v1" });
    expect(await getAccountSettings(deps, { userId: other.id })).toMatchObject({
      theme: "system",
    });
    await expect(
      updateAccountSettings(deps, {
        userId: user.id,
        settings: { theme: "light", locale: "invalid_tag", timezone: "UTC" },
      })
    ).rejects.toThrow();
  });
});
