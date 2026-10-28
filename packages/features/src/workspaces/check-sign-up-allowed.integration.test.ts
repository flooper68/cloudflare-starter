import { describe, expect, it } from "vitest";

import {
  fixedClock,
  invite,
  seedUser,
  seedWorkspace,
  settings,
  testDb,
} from "../../test/fixtures";
import { checkSignUpAllowed } from "./check-sign-up-allowed";

const deps = (at?: string) => ({ db: testDb(), clock: fixedClock(at) });
const inviteOnly = settings({
  signUp: "invite",
  signUpDomains: ["acme.test"],
  bootstrapAdminEmail: "founder@acme.test",
});

describe("checkSignUpAllowed", () => {
  it("lets in anyone with open sign-up", async () => {
    expect(
      await checkSignUpAllowed(deps(), {
        email: "nicole@example.test",
        settings: settings(),
      })
    ).toEqual({ allowed: true, reason: "open" });
  });

  it("invite-only: refuses strangers, allows the domain, the bootstrap admin and pending invitations", async () => {
    await expect(
      checkSignUpAllowed(deps(), {
        email: "stranger@example.test",
        settings: inviteOnly,
      })
    ).rejects.toMatchObject({
      name: "SignUpNotAllowedError",
      kind: "forbidden",
    });
    expect(
      (
        await checkSignUpAllowed(deps(), {
          email: "ada@acme.test",
          settings: inviteOnly,
        })
      ).reason
    ).toBe("domain");
    expect(
      (
        await checkSignUpAllowed(deps(), {
          email: "founder@acme.test",
          settings: inviteOnly,
        })
      ).reason
    ).toBe("bootstrap");

    const owner = await seedUser("Ada Lovelace");
    const actor = await seedWorkspace(owner.id);
    await invite(actor, "guest@example.test");
    expect(
      (
        await checkSignUpAllowed(deps(), {
          email: "Guest@example.test",
          settings: inviteOnly,
        })
      ).reason
    ).toBe("invitation");
    await expect(
      checkSignUpAllowed(deps("2026-12-01T00:00:00.000Z"), {
        email: "guest@example.test",
        settings: inviteOnly,
      })
    ).rejects.toMatchObject({ name: "SignUpNotAllowedError" });
    await expect(
      checkSignUpAllowed(deps(), {
        email: "guest@example.test",
        settings: { ...inviteOnly, mode: "personal" },
      })
    ).rejects.toMatchObject({ name: "SignUpNotAllowedError" });
  });
});
