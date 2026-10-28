import { env as workerEnv } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { createAuthOptions } from "@/server/auth";

import {
  callerFor,
  envWith,
  inviteByMail,
  signUp,
  signUpRequest,
} from "./helpers";

/**
 * The sign-up was refused: no user was created. Without email verification the answer
 * is 403 SIGN_UP_INVITE_ONLY; with it (required whenever BOOTSTRAP_ADMIN_EMAIL is set)
 * Better Auth answers every sign-up with the same generic "check your email" response, so
 * a refusal cannot be told from a success (its protection against enumerating accounts).
 */
async function refused(response: Response, email: string) {
  const body = (await response.json()) as { code?: string; token?: unknown };
  if (response.status === 403) {
    expect(body).toMatchObject({ code: "SIGN_UP_INVITE_ONLY" });
  } else {
    expect(response.status).toBe(200);
    expect(body.token).toBeNull();
  }
  const row = await workerEnv.DB.prepare(
    "SELECT count(*) AS n FROM user WHERE email = ?"
  )
    .bind(email)
    .first<{ n: number }>();
  expect(row?.n).toBe(0);
}

describe("sign-up settings at startup", () => {
  it("refuses domain sign-ups into the single workspace without email verification", () => {
    expect(() =>
      createAuthOptions(
        envWith({
          WORKSPACE_MODE: "single",
          SIGN_UP: "invite",
          SIGN_UP_DOMAINS: "acme.test",
          BOOTSTRAP_ADMIN_EMAIL: "boss@acme.test",
          AUTH_REQUIRE_EMAIL_VERIFICATION: "false",
        })
      )
    ).toThrow(/^SIGN_UP_DOMAINS in single mode/);
  });

  it("refuses a bootstrap admin without email verification", () => {
    const settings = {
      WORKSPACE_MODE: "multi",
      SIGN_UP: "invite",
      BOOTSTRAP_ADMIN_EMAIL: "founder@acme.test",
    } as const;
    expect(() =>
      createAuthOptions(
        envWith({ ...settings, AUTH_REQUIRE_EMAIL_VERIFICATION: "false" })
      )
    ).toThrow(/^BOOTSTRAP_ADMIN_EMAIL needs AUTH_REQUIRE_EMAIL_VERIFICATION/);
    expect(() =>
      createAuthOptions(
        envWith({ ...settings, AUTH_REQUIRE_EMAIL_VERIFICATION: "true" })
      )
    ).not.toThrow();
  });

  it("refuses to start without WORKSPACE_MODE and SIGN_UP (no defaults)", () => {
    // Blank counts as unset (and hides the test bindings that also reach process.env).
    const unset = {
      ...envWith({ WORKSPACE_MODE: "multi" }),
      WORKSPACE_MODE: "",
      SIGN_UP: "",
    };
    expect(() => createAuthOptions(unset)).toThrow(
      /WORKSPACE_MODE must be personal, single or multi/
    );
  });
});

// The sign-up gate runs in Better Auth's user.create.before hook (server/auth.ts), so
// these go through the real handler; Google sign-ups hit the same hook.
describe("sign-up policy", () => {
  it("invite-only without email verification answers 403 SIGN_UP_INVITE_ONLY", async () => {
    const env = envWith({
      WORKSPACE_MODE: "multi",
      SIGN_UP: "invite",
      SIGN_UP_DOMAINS: "acme.test",
    });
    const response = await signUpRequest(
      "Mallory",
      "mallory@example.test",
      env
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: "SIGN_UP_INVITE_ONLY",
    });
  });

  it("SIGN_UP=open lets anyone in, in every mode", async () => {
    for (const mode of ["personal", "single", "multi"] as const) {
      const env = envWith({
        WORKSPACE_MODE: mode,
        SIGN_UP: "open",
        BOOTSTRAP_ADMIN_EMAIL: "founder@acme.test",
      });
      const response = await signUpRequest(
        `Open ${mode}`,
        `open-${mode}@example.test`,
        env
      );
      expect(response.status).toBe(200);
    }
  });

  it("multi, invite-only: strangers are refused; the domain, the bootstrap admin and invitees get in", async () => {
    const env = envWith({
      WORKSPACE_MODE: "multi",
      SIGN_UP: "invite",
      SIGN_UP_DOMAINS: "acme.test",
      BOOTSTRAP_ADMIN_EMAIL: "founder@example.test",
    });
    await refused(
      await signUpRequest("Stranger", "stranger@example.test", env),
      "stranger@example.test"
    );
    // Not a lookalike domain either.
    await refused(
      await signUpRequest("Lookalike", "eve@evil-acme.test", env),
      "eve@evil-acme.test"
    );

    const colleague = await signUp("Ada Lovelace", "ada@acme.test", env);
    await signUp("Founder", "Founder@Example.test", env);

    const team = await callerFor(colleague, env).workspace.create({
      name: "Acme",
    });
    await inviteByMail(colleague, team.id, "guest@example.test", "member", env);
    const guest = await signUp("Guest", "guest@example.test", env);
    expect(
      (await callerFor(guest, env).workspace.list()).items.map((w) => w.kind)
    ).toEqual(["personal"]);
  });

  it("personal, invite-only: only the domain and the bootstrap admin", async () => {
    const env = envWith({
      WORKSPACE_MODE: "personal",
      SIGN_UP: "invite",
      SIGN_UP_DOMAINS: "personal.test",
      BOOTSTRAP_ADMIN_EMAIL: "root@personal.example",
    });
    await refused(
      await signUpRequest("Nobody", "nobody@example.test", env),
      "nobody@example.test"
    );
    expect((await signUpRequest("Pat", "pat@personal.test", env)).status).toBe(
      200
    );
    expect(
      (await signUpRequest("Root", "root@personal.example", env)).status
    ).toBe(200);
  });

  it("single, invite-only: an invitee signs up, then joins with the invitation's role through the link", async () => {
    const env = envWith({
      WORKSPACE_MODE: "single",
      SIGN_UP: "invite",
      BOOTSTRAP_ADMIN_EMAIL: "boss@single.test",
    });
    await refused(
      await signUpRequest("Walk In", "walkin@single.test", env),
      "walkin@single.test"
    );
    const boss = await signUp("Boss", "boss@single.test", env);
    const { activeWorkspaceId } = await callerFor(boss, env).workspace.list();
    const token = await inviteByMail(
      boss,
      activeWorkspaceId ?? "",
      "lead@single.test",
      "owner",
      env
    );

    // Signing up with the invited address alone (unverified) joins nothing.
    const lead = await signUp("Lead", "lead@single.test", env);
    expect((await callerFor(lead, env).workspace.list()).items).toEqual([]);
    await expect(
      callerFor(lead, env).workspace.members.list({})
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await callerFor(lead, env).workspace.invitations.accept({ token });
    const { items } = await callerFor(lead, env).workspace.members.list({});
    // (The open sign-up test above already joined this file's single workspace.)
    expect(
      items
        .filter((member) => member.email.endsWith("@single.test"))
        .map((member) => [member.email, member.role])
    ).toEqual([
      ["boss@single.test", "owner"],
      ["lead@single.test", "owner"],
    ]);
  });
});
