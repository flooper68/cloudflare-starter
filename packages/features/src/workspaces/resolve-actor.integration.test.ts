import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  addMember,
  seedUser,
  seedWorkspace,
  testDb,
} from "../../test/fixtures";
import { resolveActor } from "./resolve-actor";

describe("resolveActor", () => {
  it("resolves the named workspace for members and hides others", async () => {
    const owner = await seedUser("Ada Lovelace");
    const colleague = await seedUser("Grace Hopper");
    await seedWorkspace(owner.id, { id: "ws-acme" });
    await addMember("ws-acme", colleague.id);
    await seedWorkspace(owner.id, { id: "ws-private" });
    const deps = { db: testDb() };

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
    const deps = { db: testDb() };

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

  it("finds nothing for a user without workspaces", async () => {
    await expect(
      resolveActor({ db: testDb() }, { userId: "nobody", mode: "personal" })
    ).rejects.toMatchObject({ name: "WorkspaceNotFoundError" });
  });
});
