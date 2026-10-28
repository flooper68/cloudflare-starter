import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import {
  fixedClock,
  seedUser,
  sequentialIds,
  settings,
  testDb,
  testRequestContext,
} from "../../test/fixtures";
import { createMemoryProductAnalytics } from "../platform";
import { provisionUser } from "./provision-user";

let run = 0;
const deps = () => ({
  db: testDb(),
  clock: fixedClock(),
  // Storage is per file, not per test: fresh ids for every call.
  ids: sequentialIds(`${String(++run).padStart(8, "0")}-0000-4000-8000-`),
  requestContext: testRequestContext(),
  analytics: createMemoryProductAnalytics(),
});

async function membershipsOf(userId: string) {
  const { results } = await env.DB.prepare(
    "SELECT w.id, w.kind, w.name, m.role FROM workspace_members m JOIN workspaces w ON w.id = m.workspace_id WHERE m.user_id = ?"
  )
    .bind(userId)
    .all();
  return results;
}

describe("provisionUser", () => {
  it.each(["personal", "multi"] as const)(
    "%s mode: gives the user a personal workspace they own",
    async (mode) => {
      const ada = await seedUser(`Ada ${mode}`);
      const provisioning = deps();
      const result = await provisionUser(provisioning, {
        user: ada,
        settings: settings({ mode }),
        sharedWorkspaceName: "Acme",
      });
      expect(result.role).toBe("owner");
      expect(await membershipsOf(ada.id)).toEqual([
        {
          id: result.workspaceId,
          kind: "personal",
          name: "Personal",
          role: "owner",
        },
      ]);
      expect(
        provisioning.analytics.recorded.map((call) => [
          call.event,
          call.properties,
        ])
      ).toEqual([
        ["workspaces.created", { kind: "personal" }],
        ["$identify", { role: "owner", workspace_size: "1", plan: null }],
      ]);
      // A second run (resolveActor healing) creates nothing and tracks nothing.
      const again = deps();
      await provisionUser(again, {
        user: ada,
        settings: settings({ mode }),
        sharedWorkspaceName: "Acme",
      });
      expect(again.analytics.recorded).toEqual([]);
    }
  );

  it("single mode: the first sign-up creates the app workspace, the bootstrap admin owns it, others join as members", async () => {
    const single = settings({
      mode: "single",
      bootstrapAdminEmail: "founder@acme.test",
    });
    const early = await seedUser("Early Bird", "early@acme.test");
    const founder = await seedUser("Founder", "founder@acme.test");

    const joining = deps();
    expect(
      await provisionUser(joining, {
        user: early,
        settings: single,
        sharedWorkspaceName: "Acme",
      })
    ).toEqual({ workspaceId: "single-workspace", role: "member" });
    expect(
      joining.analytics.recorded.map((call) => [call.event, call.properties])
    ).toEqual([
      ["workspaces.created", { kind: "shared" }],
      ["workspaces.member_joined", { role: "member", via: "sign_up" }],
      ["$identify", { role: "member", workspace_size: "1", plan: null }],
    ]);
    expect(
      await provisionUser(deps(), {
        user: { ...founder, email: "Founder@Acme.test" },
        settings: single,
        sharedWorkspaceName: "Acme",
      })
    ).toEqual({ workspaceId: "single-workspace", role: "owner" });

    const { results } = await env.DB.prepare(
      "SELECT id, kind, name FROM workspaces WHERE kind = 'shared'"
    ).all();
    expect(results).toEqual([
      { id: "single-workspace", kind: "shared", name: "Acme" },
    ]);
  });

  it("single mode, invite-only: domain sign-ups join; invitees join only through their link", async () => {
    const founder = await seedUser("Founder Two", "founder2@acme.test");
    const single = settings({
      mode: "single",
      signUp: "invite",
      signUpDomains: ["acme.test"],
      bootstrapAdminEmail: "founder2@acme.test",
    });
    await provisionUser(deps(), {
      user: founder,
      settings: single,
      sharedWorkspaceName: "Acme",
    });
    await env.DB.prepare(
      "INSERT INTO workspace_invitations (id, workspace_id, email, role, token_hash, invited_by, expires_at) VALUES ('inv-1', 'single-workspace', 'guest@example.test', 'owner', 'hash-1', ?, ?)"
    )
      .bind(founder.id, Date.parse("2026-11-01T00:00:00Z"))
      .run();

    const colleague = await seedUser("Colleague", "colleague@acme.test");
    expect(
      await provisionUser(deps(), {
        user: colleague,
        settings: single,
        sharedWorkspaceName: "Acme",
      })
    ).toEqual({ workspaceId: "single-workspace", role: "member" });

    // Signing up with an invited address proves nothing; the link's token does.
    const guest = await seedUser("Guest", "guest@example.test");
    expect(
      await provisionUser(deps(), {
        user: guest,
        settings: single,
        sharedWorkspaceName: "Acme",
      })
    ).toEqual({ workspaceId: null, role: null });
    const invitation = await env.DB.prepare(
      "SELECT accepted_at FROM workspace_invitations WHERE id = 'inv-1'"
    ).first<{ accepted_at: number | null }>();
    expect(invitation?.accepted_at).toBeNull();
    expect(await membershipsOf(guest.id)).toEqual([]);
  });
});
