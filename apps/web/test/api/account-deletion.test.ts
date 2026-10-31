import type { APIContext } from "astro";
import { describe, expect, it } from "vitest";

import { POST } from "@/pages/api/files/index";
import { getAuth } from "@/server/auth";

import {
  APP_URL,
  callerFor,
  env,
  envWith,
  inviteByMail,
  signUp,
  type TestUser,
  testRequestContext,
} from "./helpers";

async function deleteUser(user: TestUser, runtimeEnv = env) {
  // Supported server gateway operation: private invocation identity spans both auth hooks.
  const auth = getAuth(runtimeEnv);
  await auth.withErasureOperation(crypto.randomUUID(), async () => {
    const context = await auth.$context;
    await context.internalAdapter.deleteUser(user.id);
  });
}

async function objectCount() {
  return (await env.FILES.list()).objects.length;
}

describe("user deletion (Better Auth user.delete.before hook)", () => {
  it("personal mode: deletes the user's workspace, its rows and its objects", async () => {
    const personalEnv = envWith({ WORKSPACE_MODE: "personal" });
    const user = await signUp(
      "Leaving Soon",
      "leaving@example.test",
      personalEnv
    );
    const { activeWorkspaceId } = await callerFor(
      user,
      personalEnv
    ).workspace.list();
    const form = new FormData();
    form.set("file", new File(["draft"], "draft.txt", { type: "text/plain" }));
    const uploaded = await POST({
      request: new Request(`${APP_URL}/api/files`, {
        method: "POST",
        body: form,
        headers: { origin: APP_URL },
      }),
      url: new URL(`${APP_URL}/api/files`),
      locals: { user, requestContext: testRequestContext() },
    } as unknown as APIContext);
    expect(uploaded.status).toBe(201);
    const before = await objectCount();

    await deleteUser(user, personalEnv);
    expect(await objectCount()).toBe(before - 1);
    const left = await env.DB.prepare(
      "SELECT count(*) AS n FROM workspaces WHERE id = ?"
    )
      .bind(activeWorkspaceId)
      .first<{ n: number }>();
    expect(left?.n).toBe(0);
  });

  it("multi mode: refuses while the user is a shared workspace's last owner, then leaves it", async () => {
    const owner = await signUp("Team Owner", "owner@acme.test");
    const member = await signUp("Team Member", "member@acme.test");
    const team = await callerFor(owner).workspace.create({ name: "Acme" });
    const token = await inviteByMail(owner, team.id, member.email);
    await callerFor(member).workspace.invitations.accept({ token });

    await expect(deleteUser(owner)).rejects.toMatchObject({
      body: { code: "LAST_OWNER" },
    });
    expect(
      (await callerFor(member).workspace.members.list({ workspaceId: team.id }))
        .items
    ).toHaveLength(2);

    await deleteUser(member);
    expect(
      (
        await callerFor(owner).workspace.members.list({ workspaceId: team.id })
      ).items.map((m) => m.email)
    ).toEqual(["owner@acme.test"]);
  });
});
