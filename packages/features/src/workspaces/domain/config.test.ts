import { describe, expect, it } from "vitest";

import { workspaceSettingsSchema } from "./config";

const parse = (vars: Record<string, string | undefined>) =>
  workspaceSettingsSchema.safeParse(vars);

const messages = (vars: Record<string, string | undefined>) => {
  const result = parse(vars);
  return result.success
    ? []
    : result.error.issues.map((issue) => issue.message);
};

describe("workspaceSettingsSchema", () => {
  it("parses the settings, normalising domains and the bootstrap email", () => {
    expect(
      workspaceSettingsSchema.parse({
        WORKSPACE_MODE: "multi",
        SIGN_UP: "invite",
        SIGN_UP_DOMAINS: " Acme.test, @example.org ,",
        BOOTSTRAP_ADMIN_EMAIL: "Founder@Acme.test",
      })
    ).toEqual({
      mode: "multi",
      signUp: "invite",
      signUpDomains: ["acme.test", "example.org"],
      bootstrapAdminEmail: "founder@acme.test",
    });
  });

  it("needs WORKSPACE_MODE and SIGN_UP: no defaults", () => {
    expect(messages({})).toEqual(
      expect.arrayContaining([
        "WORKSPACE_MODE must be personal, single or multi",
        "SIGN_UP must be open or invite",
      ])
    );
    expect(messages({ WORKSPACE_MODE: "teams", SIGN_UP: "open" })).toEqual([
      "WORKSPACE_MODE must be personal, single or multi",
    ]);
  });

  it("needs an owner for the single workspace", () => {
    expect(messages({ WORKSPACE_MODE: "single", SIGN_UP: "open" })).toEqual([
      "WORKSPACE_MODE=single needs BOOTSTRAP_ADMIN_EMAIL: the owner of the app's workspace",
    ]);
  });

  it("refuses an invite-only setup nobody could ever sign up to", () => {
    expect(messages({ WORKSPACE_MODE: "multi", SIGN_UP: "invite" })).toEqual([
      "SIGN_UP=invite needs BOOTSTRAP_ADMIN_EMAIL or SIGN_UP_DOMAINS, or nobody can ever sign up",
    ]);
    expect(
      parse({
        WORKSPACE_MODE: "personal",
        SIGN_UP: "invite",
        SIGN_UP_DOMAINS: "acme.test",
      }).success
    ).toBe(true);
  });

  it("rejects malformed domains and emails", () => {
    expect(
      messages({
        WORKSPACE_MODE: "multi",
        SIGN_UP: "open",
        SIGN_UP_DOMAINS: "acme",
      })
    ).toEqual(['SIGN_UP_DOMAINS: "acme" is not a domain']);
    expect(
      messages({
        WORKSPACE_MODE: "multi",
        SIGN_UP: "open",
        BOOTSTRAP_ADMIN_EMAIL: "founder",
      })
    ).toEqual(["BOOTSTRAP_ADMIN_EMAIL must be an email address"]);
  });
});
