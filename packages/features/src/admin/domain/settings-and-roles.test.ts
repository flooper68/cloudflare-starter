import { describe, expect, it } from "vitest";

import { deploymentSettings } from "./deployment-settings";
import { hasAdminRole, platformRoleOf } from "./platform-role";

describe("platform roles", () => {
  it.each([
    ["admin", true],
    ["user,admin", true],
    [" admin ", true],
    ["user", false],
    ["administrator", false],
    ["", false],
    [null, false],
    [undefined, false],
  ])("%j is admin: %s", (role, admin) => {
    expect(hasAdminRole(role)).toBe(admin);
    expect(platformRoleOf(role)).toBe(admin ? "admin" : "user");
  });
});

describe("deployment settings", () => {
  const base = {
    environment: "production",
    workspaceMode: "multi" as const,
    signUp: "invite" as const,
    signUpDomains: ["acme.test"],
    bootstrapAdminEmail: "founder@acme.test",
    emailEnabled: true,
    adminPortal: "on" as const,
  };

  it("lists the enabled sign-in methods", () => {
    expect(
      deploymentSettings({
        ...base,
        methods: {
          emailPassword: true,
          google: true,
          requireEmailVerification: true,
        },
      })
    ).toEqual({
      ...base,
      signInMethods: ["email_password", "google"],
      emailVerificationRequired: true,
    });
  });

  it("verification only applies to email + password", () => {
    expect(
      deploymentSettings({
        ...base,
        methods: {
          emailPassword: false,
          google: true,
          requireEmailVerification: true,
        },
      })
    ).toMatchObject({
      signInMethods: ["google"],
      emailVerificationRequired: false,
    });
  });
});
