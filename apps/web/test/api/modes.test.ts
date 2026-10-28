import { describe, expect, it } from "vitest";

import { callerFor, env, envWith, signUp } from "./helpers";

/** What a failed provisioning at sign-up leaves behind: an account without a workspace. */
async function dropWorkspaces(userId: string) {
  await env.DB.prepare(
    "DELETE FROM workspaces WHERE id IN (SELECT workspace_id FROM workspace_members WHERE user_id = ?)"
  )
    .bind(userId)
    .run();
}

describe("workspace modes", () => {
  it("personal: one workspace per user, no members, invitations, creation or switching", async () => {
    const env = envWith({ WORKSPACE_MODE: "personal" });
    const nicole = await signUp("Nicole Example", "nicole@personal.test", env);
    const caller = callerFor(nicole, env);

    const list = await caller.workspace.list();
    expect(list.mode).toBe("personal");
    expect(list.items).toMatchObject([{ kind: "personal", role: "owner" }]);
    expect(await caller.storage.listFiles({})).toEqual({ items: [] });

    for (const call of [
      () => caller.workspace.members.list({}),
      () => caller.workspace.invitations.list({}),
      () =>
        caller.workspace.invitations.create({
          email: "friend@personal.test",
          role: "member",
        }),
      () => caller.workspace.create({ name: "Side project" }),
      () =>
        caller.workspace.switch({ workspaceId: list.activeWorkspaceId ?? "" }),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("single: everyone shares the app workspace; the bootstrap admin owns it; nothing to create", async () => {
    const env = envWith({
      WORKSPACE_MODE: "single",
      BOOTSTRAP_ADMIN_EMAIL: "founder@single.test",
    });
    const early = await signUp("Early Bird", "early@single.test", env);
    const founder = await signUp("Founder", "founder@single.test", env);

    const earlyList = await callerFor(early, env).workspace.list();
    const founderList = await callerFor(founder, env).workspace.list();
    expect(earlyList.activeWorkspaceId).toBe(founderList.activeWorkspaceId);
    expect(earlyList.items).toMatchObject([
      { kind: "shared", name: "Cloudflare Starter", role: "member" },
    ]);
    expect(founderList.items).toMatchObject([{ role: "owner" }]);

    await expect(
      callerFor(founder, env).workspace.create({ name: "Another" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const { items } = await callerFor(early, env).workspace.members.list({});
    expect(items).toHaveLength(2);
  });

  it.each(["personal", "multi"] as const)(
    "%s: a user whose provisioning failed gets their personal workspace on first use",
    async (mode) => {
      const modeEnv = envWith({ WORKSPACE_MODE: mode });
      const user = await signUp(
        `Unlucky ${mode}`,
        `unlucky-${mode}@example.test`,
        modeEnv
      );
      await dropWorkspaces(user.id);
      expect((await callerFor(user, modeEnv).workspace.list()).items).toEqual(
        []
      );

      expect(await callerFor(user, modeEnv).storage.listFiles({})).toEqual({
        items: [],
      });
      expect((await callerFor(user, modeEnv).workspace.list()).items).toEqual([
        {
          id: `personal-${user.id}`,
          name: "Personal",
          kind: "personal",
          role: "owner",
        },
      ]);
    }
  );

  it("single: a user without membership is told to ask for an invitation", async () => {
    const singleEnv = envWith({
      WORKSPACE_MODE: "single",
      BOOTSTRAP_ADMIN_EMAIL: "founder@lonely.test",
    });
    const user = await signUp("Lonely", "lonely@lonely.test", singleEnv);
    await dropWorkspaces(user.id);

    await expect(
      callerFor(user, singleEnv).storage.listFiles({})
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      cause: { code: "NOT_A_WORKSPACE_MEMBER" },
    });
  });
});
