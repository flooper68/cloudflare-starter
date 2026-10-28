import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  addMember,
  auditTrail,
  rows,
  seedUser,
  seedWorkspace,
  useCaseDeps,
} from "../../test/fixtures";
import { resolveActor } from "./resolve-actor";

describe("resolveActor", () => {
  it("resolves the named workspace for members and hides others", async () => {
    const owner = await seedUser("Ada Lovelace");
    const colleague = await seedUser("Grace Hopper");
    await seedWorkspace(owner.id, { id: "ws-acme" });
    await addMember("ws-acme", colleague.id);
    await seedWorkspace(owner.id, { id: "ws-private" });
    const deps = useCaseDeps();

    expect(
      await resolveActor(deps, {
        userId: colleague.id,
        mode: "multi",
        workspaceId: "ws-acme",
      })
    ).toEqual({ userId: colleague.id, workspaceId: "ws-acme", role: "member" });
    await expect(
      resolveActor(deps, {
        userId: colleague.id,
        mode: "multi",
        workspaceId: "ws-private",
      })
    ).rejects.toMatchObject({
      name: "WorkspaceNotFoundError",
      kind: "not_found",
    });
  });

  it("defaults to the most recently active membership, then the newest", async () => {
    const user = await seedUser("Ken Thompson");
    await seedWorkspace(user.id, { id: "ws-a" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await seedWorkspace(user.id, { id: "ws-b" });
    const deps = useCaseDeps();

    expect(
      (await resolveActor(deps, { userId: user.id, mode: "multi" })).workspaceId
    ).toBe("ws-b");
    await env.DB.prepare(
      "UPDATE workspace_members SET last_active_at = 1 WHERE workspace_id = 'ws-a'"
    ).run();
    expect(
      (await resolveActor(deps, { userId: user.id, mode: "multi" })).workspaceId
    ).toBe("ws-a");
  });

  it.each(["personal", "multi"] as const)(
    "%s mode: heals a user whose sign-up provisioning failed with their personal workspace, once",
    async (mode) => {
      // A user without any membership: provisioning failed open at sign-up.
      const user = await seedUser(`Heal ${mode}`);
      const first = await resolveActor(useCaseDeps(), {
        userId: user.id,
        mode,
      });
      expect(first).toEqual({
        userId: user.id,
        workspaceId: `personal-${user.id}`,
        role: "owner",
      });
      // Idempotent, also when two requests heal at once: one workspace, one audit event.
      await Promise.all([
        resolveActor(useCaseDeps(), { userId: user.id, mode }),
        resolveActor(useCaseDeps(), { userId: user.id, mode }),
      ]);
      expect(
        await rows(
          "SELECT workspace_id, role FROM workspace_members WHERE user_id = ?",
          user.id
        )
      ).toEqual([{ workspace_id: `personal-${user.id}`, role: "owner" }]);
      expect(
        (await auditTrail(`personal-${user.id}`)).map((event) => event.action)
      ).toEqual(["workspace.created"]);
    }
  );

  it("single mode: a user without membership is told to ask for an invitation", async () => {
    const user = await seedUser("Walk In");
    await expect(
      resolveActor(useCaseDeps(), { userId: user.id, mode: "single" })
    ).rejects.toMatchObject({
      name: "NotWorkspaceMemberError",
      kind: "forbidden",
      code: "NOT_A_WORKSPACE_MEMBER",
    });
    expect(
      await rows("SELECT 1 FROM workspace_members WHERE user_id = ?", user.id)
    ).toEqual([]);
  });

  it("does not heal when a named workspace is not the user's", async () => {
    const user = await seedUser("Named Elsewhere");
    await expect(
      resolveActor(useCaseDeps(), {
        userId: user.id,
        mode: "multi",
        workspaceId: "ws-acme",
      })
    ).rejects.toMatchObject({ name: "WorkspaceNotFoundError" });
  });
});
