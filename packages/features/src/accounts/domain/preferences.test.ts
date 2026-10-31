import { describe, expect, it } from "vitest";
import { accountSettingsSchema } from "./preferences";

describe("account preferences", () => {
  it("accepts supported formatting and refuses invalid Intl parameters", () => {
    expect(
      accountSettingsSchema.parse({
        theme: "dark",
        locale: "cs-CZ",
        timezone: "Europe/Prague",
      }).locale
    ).toBe("cs-CZ");
    for (const value of [
      { theme: "blue" },
      { timezone: "Mars/Olympus" },
      { locale: "not_a_locale" },
      { locale: "zz-ZZ" },
    ])
      expect(
        accountSettingsSchema.safeParse({
          theme: "system",
          locale: "en",
          timezone: "UTC",
          ...value,
        }).success
      ).toBe(false);
  });
});
