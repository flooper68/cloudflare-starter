import { describe, expect, it } from "vitest";

import { WORKSPACE_MODES, type WorkspaceMode } from "./mode";
import {
  decideSignUp,
  type SignUpDecision,
  type SignUpPolicy,
} from "./sign-up-policy";

const BOOTSTRAP = "founder@acme.test";

type Case = readonly [
  mode: WorkspaceMode,
  policy: SignUpPolicy,
  domains: readonly string[],
  email: string,
  invitation: boolean,
  expected: SignUpDecision,
];

const denied = { allowed: false } as const;
const allow = (reason: "bootstrap" | "open" | "domain" | "invitation") =>
  ({ allowed: true, reason }) as const;

/** Every mode × policy × allowlist × bootstrap × invitation combination that matters. */
const cases: Case[] = WORKSPACE_MODES.flatMap((mode): Case[] => [
  // Open sign-up lets anyone in; the bootstrap admin is recognised first.
  [mode, "open", [], "nicole@example.test", false, allow("open")],
  [mode, "open", ["acme.test"], "nicole@example.test", false, allow("open")],
  [mode, "open", [], BOOTSTRAP, false, allow("bootstrap")],
  // Invite-only: the bootstrap admin always, case-insensitively.
  [mode, "invite", [], BOOTSTRAP, false, allow("bootstrap")],
  [mode, "invite", [], " Founder@ACME.test ", false, allow("bootstrap")],
  // Invite-only: an allowed domain, matched on the whole domain.
  [mode, "invite", ["acme.test"], "ada@acme.test", false, allow("domain")],
  [mode, "invite", ["acme.test"], "ada@ACME.test", false, allow("domain")],
  [mode, "invite", ["acme.test"], "ada@evil-acme.test", false, denied],
  [mode, "invite", ["acme.test"], "ada@acme.test.evil", false, denied],
  // Invite-only: nobody else without an invitation.
  [mode, "invite", [], "stranger@example.test", false, denied],
  [mode, "invite", ["acme.test"], "stranger@example.test", false, denied],
  // Invite-only: an invitation works only in modes that have invitations.
  [
    mode,
    "invite",
    [],
    "invited@example.test",
    true,
    mode === "personal" ? denied : allow("invitation"),
  ],
]);

describe("decideSignUp", () => {
  it.each(cases)(
    "%s, SIGN_UP=%s, domains %j: %s (invited: %s)",
    (mode, policy, allowedDomains, email, hasPendingInvitation, expected) => {
      expect(
        decideSignUp({
          mode,
          policy,
          allowedDomains,
          bootstrapAdminEmail: BOOTSTRAP,
          email,
          hasPendingInvitation,
        })
      ).toEqual(expected);
    }
  );

  it("has no bootstrap admin when none is configured", () => {
    expect(
      decideSignUp({
        mode: "multi",
        policy: "invite",
        allowedDomains: [],
        bootstrapAdminEmail: null,
        email: BOOTSTRAP,
        hasPendingInvitation: false,
      })
    ).toEqual(denied);
  });
});
