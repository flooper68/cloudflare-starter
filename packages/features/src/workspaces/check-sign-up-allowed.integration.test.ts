import { describe, expect, it } from "vitest";
import {
  addMember,
  billingDeps,
  fixedClock,
  invite,
  seedUser,
  seedWorkspace,
  settings,
  testBilling,
  testDb,
} from "../../test/fixtures";
import { setOverride } from "../billing";
import { checkSignUpAllowed } from "./check-sign-up-allowed";
import { SINGLE_WORKSPACE_ID } from "./domain";

const deps = (at?: string, billing = testBilling("off")) => ({
  db: testDb(),
  clock: fixedClock(at),
  billing,
});
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

  it("single mode: joining the app's workspace takes a seat, except for the bootstrap admin and invitees", async () => {
    const founder = await seedUser("Frances Founder", "founder@acme.test");
    const owner = await seedWorkspace(founder.id, { id: SINGLE_WORKSPACE_ID });
    const admin = await seedUser("Alan Admin");
    await setOverride(
      billingDeps(),
      { userId: admin.id },
      {
        workspaceId: SINGLE_WORKSPACE_ID,
        key: "seats",
        override: { kind: "limit", limit: 3 },
        reason: "Small team",
      }
    );
    const single = settings({
      mode: "single",
      signUp: "open",
      bootstrapAdminEmail: "founder@acme.test",
    });
    const manual = () => deps(undefined, testBilling("manual"));

    // Founder plus one member: one seat left.
    const colleague = await seedUser("Grace Hopper");
    await addMember(SINGLE_WORKSPACE_ID, colleague.id);
    await expect(
      checkSignUpAllowed(manual(), {
        email: "new@example.test",
        settings: single,
      })
    ).resolves.toEqual({ allowed: true, reason: "open" });

    // The last seat goes to a pending invitation: a stranger is refused, the invitee is not.
    await invite(owner, "invited@example.test");
    await expect(
      checkSignUpAllowed(manual(), {
        email: "stranger@example.test",
        settings: single,
      })
    ).rejects.toMatchObject({
      kind: "limit_reached",
      code: "LIMIT_REACHED",
      details: { metric: "seats", limit: 3, current: 3 },
    });
    await expect(
      checkSignUpAllowed(manual(), {
        email: "invited@example.test",
        settings: single,
      })
    ).resolves.toMatchObject({ allowed: true });
    await expect(
      checkSignUpAllowed(manual(), {
        email: "founder@acme.test",
        settings: single,
      })
    ).resolves.toEqual({ allowed: true, reason: "bootstrap" });
    // Billing off: no limits.
    await expect(
      checkSignUpAllowed(deps(), {
        email: "stranger@example.test",
        settings: single,
      })
    ).resolves.toEqual({ allowed: true, reason: "open" });
  });
});
