import { describe, expect, it } from "vitest";
import { seedUser } from "../../test/fixtures";
import { profileDeps } from "../../test/profile-fixtures";
import { getAccountSettings } from "./get-account-settings";

describe("getAccountSettings", () => {
  it("preserves ownership and the settings contract", async () => {
    const user = await seedUser();
    expect(
      await getAccountSettings(profileDeps(), { userId: user.id })
    ).toEqual({
      theme: "system",
      timezone: "UTC",
      locale: "en",
      avatarUrl: null,
    });
  });
});
