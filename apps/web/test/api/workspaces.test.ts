import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  callerFor,
  env,
  expectCrossWorkspaceDenied,
  inviteByMail,
  mailEnv,
  outbox,
  signUp,
  type TestUser,
  testRequestContext,
} from "./helpers";

// Multi mode (vitest.config.ts bindings): create, invite, accept, roles, leave, transfer.
describe("workspace procedures (multi mode, real D1)", () => {
  let ada: TestUser;
  let grace: TestUser;
  let alan: TestUser;
  let teamId: string;

  beforeAll(async () => {
    ada = await signUp("Ada Lovelace", "ada@acme.test");
    grace = await signUp("Grace Hopper", "grace@acme.test");
    alan = await signUp("Alan Turing", "alan@acme.test");
  });

  it("refuses anonymous callers", async () => {
    await expect(callerFor(null).workspace.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      callerFor(null).workspace.members.list({})
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("workspace.list shows the personal workspace made at sign-up", async () => {
    const list = await callerFor(ada).workspace.list();
    expect(list.mode).toBe("multi");
    expect(list.items).toEqual([
      {
        id: list.activeWorkspaceId,
        name: "Personal",
        kind: "personal",
        role: "owner",
      },
    ]);
  });

  it("workspace.create makes a shared workspace current", async () => {
    const team = await callerFor(ada).workspace.create({
      name: "Analytical Engines",
    });
    teamId = team.id;
    expect(team).toMatchObject({ kind: "shared", role: "owner" });
    expect((await callerFor(ada).workspace.list()).activeWorkspaceId).toBe(
      teamId
    );
  });

  it("workspace.invitations.create mails a link and never returns it", async () => {
    const created = await callerFor(ada, mailEnv).workspace.invitations.create({
      workspaceId: teamId,
      email: "Grace@Acme.test",
      role: "member",
    });
    expect(created).toMatchObject({
      email: "grace@acme.test",
      role: "member",
      delivered: true,
    });
    expect(JSON.stringify(created)).not.toMatch(/invite\//);
    expect(outbox.at(-1)?.text).toMatch(/\/invite\/[0-9a-f]{64}/);

    await expect(
      callerFor(ada).workspace.invitations.create({
        workspaceId: teamId,
        email: "not-an-email",
        role: "member",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("workspace.invitations.list shows the pending invitation to owners", async () => {
    const { items } = await callerFor(ada).workspace.invitations.list({
      workspaceId: teamId,
    });
    expect(items.map((item) => [item.email, item.status])).toEqual([
      ["grace@acme.test", "pending"],
    ]);
  });

  it("workspace.invitations.preview and accept: only the invited account joins", async () => {
    const token = await inviteByMail(ada, teamId, grace.email);
    expect(
      await callerFor(null).workspace.invitations.preview({ token })
    ).toMatchObject({
      status: "pending",
      workspaceName: "Analytical Engines",
      inviterName: "Ada Lovelace",
      email: "grace@acme.test",
    });
    await expect(
      callerFor(alan).workspace.invitations.accept({ token })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(
      await callerFor(grace).workspace.invitations.accept({ token })
    ).toEqual({ workspaceId: teamId });
    expect(
      await callerFor(null).workspace.invitations.preview({ token })
    ).toMatchObject({ status: "accepted" });
  });

  it("workspace.members.list shows the members to every member", async () => {
    const { items } = await callerFor(grace).workspace.members.list({
      workspaceId: teamId,
    });
    expect(items.map((m) => [m.email, m.role])).toEqual([
      ["ada@acme.test", "owner"],
      ["grace@acme.test", "member"],
    ]);
  });

  it("members cannot manage members or invitations", async () => {
    await expect(
      callerFor(grace).workspace.invitations.list({ workspaceId: teamId })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      callerFor(grace).workspace.members.changeRole({
        workspaceId: teamId,
        userId: grace.id,
        role: "owner",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("workspace.invitations.revoke stops a link", async () => {
    const token = await inviteByMail(ada, teamId, alan.email);
    const { items } = await callerFor(ada).workspace.invitations.list({
      workspaceId: teamId,
    });
    const invitation = items.find((item) => item.email === alan.email);
    expect(
      await callerFor(ada).workspace.invitations.revoke({
        workspaceId: teamId,
        invitationId: invitation?.id ?? "",
      })
    ).toEqual({ revoked: true });
    await expect(
      callerFor(alan).workspace.invitations.accept({ token })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("workspace.members.changeRole keeps an owner", async () => {
    await expect(
      callerFor(ada).workspace.members.changeRole({
        workspaceId: teamId,
        userId: ada.id,
        role: "member",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      await callerFor(ada).workspace.members.changeRole({
        workspaceId: teamId,
        userId: grace.id,
        role: "owner",
      })
    ).toEqual({ userId: grace.id, role: "owner" });
  });

  it("workspace.transferOwnership hands the workspace over", async () => {
    await callerFor(grace).workspace.members.changeRole({
      workspaceId: teamId,
      userId: grace.id,
      role: "member",
    });
    expect(
      await callerFor(ada).workspace.transferOwnership({
        workspaceId: teamId,
        userId: grace.id,
      })
    ).toEqual({ ownerUserId: grace.id });
  });

  it("workspace.switch changes the default workspace for later calls", async () => {
    const personal = (await callerFor(ada).workspace.list()).items.find(
      (item) => item.kind === "personal"
    );
    await callerFor(ada).workspace.switch({ workspaceId: personal?.id ?? "" });
    expect((await callerFor(ada).workspace.list()).activeWorkspaceId).toBe(
      personal?.id
    );
    await expect(
      callerFor(alan).workspace.switch({ workspaceId: teamId })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("workspace.leave and workspace.members.remove: the last owner stays", async () => {
    await expect(
      callerFor(grace).workspace.leave({ workspaceId: teamId })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      await callerFor(ada).workspace.leave({ workspaceId: teamId })
    ).toEqual({ left: true });

    const token = await inviteByMail(grace, teamId, alan.email);
    await callerFor(alan).workspace.invitations.accept({ token });
    expect(
      await callerFor(grace).workspace.members.remove({
        workspaceId: teamId,
        userId: alan.id,
      })
    ).toEqual({ removed: true });
    await expect(
      callerFor(grace).workspace.members.remove({
        workspaceId: teamId,
        userId: grace.id,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("a personal workspace cannot be shared or left", async () => {
    await expect(
      callerFor(alan).workspace.invitations.create({
        email: "someone@acme.test",
        role: "member",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(callerFor(alan).workspace.leave({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("every workspace procedure refuses a workspace the user is not a member of", async () => {
    await expectCrossWorkspaceDenied("workspace.switch", {});
    await expectCrossWorkspaceDenied("workspace.leave", {});
    await expectCrossWorkspaceDenied("workspace.transferOwnership", {
      userId: "someone",
    });
    await expectCrossWorkspaceDenied("workspace.members.list", {});
    await expectCrossWorkspaceDenied("workspace.members.changeRole", {
      userId: "someone",
      role: "owner",
    });
    await expectCrossWorkspaceDenied("workspace.members.remove", {
      userId: "someone",
    });
    await expectCrossWorkspaceDenied("workspace.invitations.list", {});
    await expectCrossWorkspaceDenied("workspace.invitations.create", {
      email: "intruder@elsewhere.test",
      role: "owner",
    });
    await expectCrossWorkspaceDenied("workspace.invitations.revoke", {
      invitationId: "someone",
    });
  });

  it("without email: logs the link locally, refuses deployed environments before writing", async () => {
    const noEmail = { ...env, EMAIL_FROM: "" };
    const local = { ...testRequestContext(), environment: "local" };
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const created = await callerFor(
      grace,
      noEmail,
      local
    ).workspace.invitations.create({
      workspaceId: teamId,
      email: "linus@acme.test",
      role: "member",
    });
    expect(created.delivered).toBe(false);
    const record = info.mock.calls
      .map(
        ([logged]) =>
          logged as {
            body: string;
            trace_id: string;
            attributes: Record<string, unknown>;
          }
      )
      .find((logged) => logged?.body === "auth.mail_not_sent");
    expect(record?.attributes["app.auth.link"]).toMatch(
      /\/invite\/[0-9a-f]{64}$/
    );
    // The workspace procedure put the workspace into the request context of its logs.
    expect(record?.attributes["app.workspace.id"]).toBe(teamId);
    expect(record?.trace_id).toBe(local.traceId);
    info.mockRestore();

    const staging = { ...testRequestContext(), environment: "staging" };
    await expect(
      callerFor(grace, noEmail, staging).workspace.invitations.create({
        workspaceId: teamId,
        email: "dennis@acme.test",
        role: "member",
      })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    const { items } = await callerFor(grace).workspace.invitations.list({
      workspaceId: teamId,
    });
    expect(items.map((item) => item.email)).not.toContain("dennis@acme.test");
  });
});
