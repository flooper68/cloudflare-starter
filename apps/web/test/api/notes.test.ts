import { createMcpHandler } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";

import { buildMcpServer } from "@/server/mcp/server";
import { buildPlatform } from "@/server/platform";

import {
  APP_URL,
  callerFor,
  env,
  expectCrossWorkspaceDenied,
  inviteByMail,
  signUp,
  testRequestContext,
} from "./helpers";

/** One tools/call through the MCP server, as the caller (like billing.test.ts). */
async function mcpCall(
  caller: ReturnType<typeof callerFor>,
  name: string,
  args: Record<string, unknown> = {}
) {
  const requestContext = testRequestContext();
  const handler = createMcpHandler(() =>
    buildMcpServer(() => caller, {
      errors: buildPlatform(env).errors,
      tracer: buildPlatform(env).tracer.withContext(requestContext),
      requestContext,
    })
  );
  const response = await handler.fetch(
    new Request(`${APP_URL}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    })
  );
  const text = await response.text();
  const json = text.startsWith("{")
    ? text
    : (text.split("\n").find((line) => line.startsWith("data: ")) ?? "").slice(
        6
      );
  return JSON.parse(json).result as {
    isError?: boolean;
    structuredContent: Record<string, unknown>;
  };
}

const noteId = "00000000-0000-4000-8000-000000000001";

describe("notes procedures", () => {
  it("create, list, get, update, comment, delete to trash and restore: members and owners", async () => {
    const owner = await signUp("Ada Lovelace", "ada@notes.test");
    const member = await signUp("Grace Hopper", "grace@notes.test");
    const team = await callerFor(owner).workspace.create({ name: "Acme" });
    const workspaceId = team.id;
    const token = await inviteByMail(owner, workspaceId, member.email);
    await callerFor(member).workspace.invitations.accept({ token });
    const asOwner = callerFor(owner);
    const asMember = callerFor(member);

    const created = await asMember.notes.create({
      workspaceId,
      title: "Q3 launch checklist",
      body: "Freeze the pricing page",
    });
    await asOwner.notes.update({
      workspaceId,
      noteId: created.id,
      body: "Freeze the pricing page\nRun the restore drill",
    });
    await asOwner.notes.comments.add({
      workspaceId,
      noteId: created.id,
      body: "The drill is booked for Thursday.",
    });

    const list = await asMember.notes.list({ workspaceId });
    expect(list.items).toEqual([
      expect.objectContaining({
        id: created.id,
        title: "Q3 launch checklist",
        createdBy: { userId: member.id, name: "Grace Hopper" },
        updatedBy: { userId: owner.id, name: "Ada Lovelace" },
        commentCount: 1,
      }),
    ]);
    const detail = await asMember.notes.get({
      workspaceId,
      noteId: created.id,
    });
    expect(detail.body).toBe("Freeze the pricing page\nRun the restore drill");
    expect(detail.comments).toEqual([
      expect.objectContaining({
        body: "The drill is booked for Thursday.",
        author: { userId: owner.id, name: "Ada Lovelace" },
      }),
    ]);

    expect(
      await asMember.notes.delete({ workspaceId, noteId: created.id })
    ).toMatchObject({ type: "note", id: created.id });
    expect((await asOwner.notes.list({ workspaceId })).items).toEqual([]);
    await expect(
      asOwner.notes.get({ workspaceId, noteId: created.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await asOwner.trash.list({ workspaceId })).items).toEqual([
      expect.objectContaining({ type: "note", label: "Q3 launch checklist" }),
    ]);
    await asMember.trash.restore({
      workspaceId,
      items: [{ type: "note", id: created.id }],
    });
    expect(
      (await asOwner.notes.get({ workspaceId, noteId: created.id })).comments
    ).toHaveLength(1);
  });

  it("answers the same through the MCP tools, user data inside the result", async () => {
    const user = await signUp("Alan Turing", "alan@notes.test");
    const caller = callerFor(user);

    const created = await mcpCall(caller, "create_note", {
      title: "Support macros",
      body: "Refunds",
    });
    expect(created.isError).toBeFalsy();
    const id = created.structuredContent.id as string;
    expect(
      (await mcpCall(caller, "update_note", { noteId: id, title: "Macros" }))
        .isError
    ).toBeFalsy();
    expect(
      (await mcpCall(caller, "add_note_comment", { noteId: id, body: "Done" }))
        .isError
    ).toBeFalsy();
    expect((await mcpCall(caller, "list_notes", {})).structuredContent).toEqual(
      { items: [expect.objectContaining({ id, title: "Macros" })] }
    );
    expect(
      (await mcpCall(caller, "get_note", { noteId: id })).structuredContent
    ).toMatchObject({
      id,
      body: "Refunds",
      comments: [expect.objectContaining({ body: "Done" })],
    });
    expect(
      (await mcpCall(caller, "delete_note", { noteId: id })).structuredContent
    ).toMatchObject({ type: "note", id });
    const missing = await mcpCall(caller, "get_note", { noteId: id });
    expect(missing.isError).toBe(true);
    expect(missing.structuredContent).toMatchObject({
      error: { code: "NOT_FOUND" },
    });
  });

  it("refuses a note past the plan's notes limit, on tRPC and through /mcp", async () => {
    const user = await signUp("Barbara Liskov", "barbara@notes.test");
    const caller = callerFor(user);
    const workspaceId = (await caller.workspace.list())
      .activeWorkspaceId as string;
    // An admin's exception, written straight to D1 (the admin procedures have their own tests).
    await env.DB.prepare(
      "INSERT INTO entitlement_override (workspace_id, key, kind, enabled, limit_value, reason, created_at) VALUES (?, 'notes', 'limit', NULL, 1, 'API test', ?)"
    )
      .bind(workspaceId, Date.now())
      .run();
    await caller.notes.create({ workspaceId, title: "The one note" });

    await expect(
      caller.notes.create({ workspaceId, title: "One too many" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      cause: {
        kind: "limit_reached",
        details: { metric: "notes", limit: 1, current: 1, increment: 1 },
      },
    });
    const tool = await mcpCall(caller, "create_note", { title: "Via MCP" });
    expect(tool.isError).toBe(true);
    expect(tool.structuredContent).toMatchObject({
      error: {
        code: "FORBIDDEN",
        domain: { kind: "limit_reached", details: { metric: "notes" } },
      },
    });
    expect(
      (await caller.workspace.billing.summary({ workspaceId })).usage.metrics
    ).toContainEqual(
      expect.objectContaining({ metric: "notes", used: 1, limit: 1 })
    );
  });

  it("search finds live notes of the caller's workspace only, by title or body, never trashed ones", async () => {
    const owner = await signUp("Katherine Johnson", "katherine@notes.test");
    const member = await signUp("Dorothy Vaughan", "dorothy@notes.test");
    const outsider = await signUp("Mary Jackson", "mary@notes.test");
    const team = await callerFor(owner).workspace.create({ name: "Langley" });
    const workspaceId = team.id;
    const token = await inviteByMail(owner, workspaceId, member.email);
    await callerFor(member).workspace.invitations.accept({ token });
    const asOwner = callerFor(owner);
    const asMember = callerFor(member);
    const asOutsider = callerFor(outsider);
    const outsiderWorkspace = (await asOutsider.workspace.list())
      .activeWorkspaceId as string;

    const titled = await asOwner.notes.create({
      workspaceId,
      title: "Orbit trajectory review",
    });
    const bodied = await asOwner.notes.create({
      workspaceId,
      title: "Monday sync",
      body: "Agenda: the orbit numbers",
    });
    const trashed = await asOwner.notes.create({
      workspaceId,
      title: "Orbit draft",
    });
    await asOwner.notes.delete({ workspaceId, noteId: trashed.id });
    await asOutsider.notes.create({
      workspaceId: outsiderWorkspace,
      title: "Orbit elsewhere",
    });

    const found = await asMember.notes.search({ workspaceId, query: "orbit" });
    expect(found.items).toEqual([
      expect.objectContaining({ id: titled.id, matched: "title" }),
      expect.objectContaining({
        id: bodied.id,
        matched: "body",
        excerpt: "Agenda: the orbit numbers",
      }),
    ]);
    // Another workspace's caller sees only their own note, and cannot ask for this one's.
    expect(
      (
        await asOutsider.notes.search({
          workspaceId: outsiderWorkspace,
          query: "orbit",
        })
      ).items.map((hit) => hit.title)
    ).toEqual(["Orbit elsewhere"]);
    await expect(
      asOutsider.notes.search({ workspaceId, query: "orbit" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Restored from the trash, it is found again.
    await asOwner.trash.restore({
      workspaceId,
      items: [{ type: "note", id: trashed.id }],
    });
    expect(
      (await asMember.notes.search({ workspaceId, query: "draft" })).items
    ).toEqual([expect.objectContaining({ id: trashed.id })]);

    await expect(
      asMember.notes.search({ workspaceId, query: " " })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      asMember.notes.search({ workspaceId, query: "orbit", limit: 21 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      callerFor(null).notes.search({ query: "orbit" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    // The same through MCP, in the caller's current workspace.
    const tool = await mcpCall(asOutsider, "search_notes", { query: "orbit" });
    expect(tool.isError).toBeFalsy();
    expect(tool.structuredContent).toEqual({
      items: [expect.objectContaining({ title: "Orbit elsewhere" })],
    });
  });

  it("refuses anonymous callers and invalid input", async () => {
    const anonymous = callerFor(null);
    await expect(anonymous.notes.list({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      anonymous.notes.create({ title: "Nope" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const user = await signUp("Edsger Dijkstra", "edsger@notes.test");
    const caller = callerFor(user);
    await expect(caller.notes.create({ title: "   " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(caller.notes.update({ noteId })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      caller.notes.comments.add({ noteId, body: "" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.notes.get({ noteId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("notes procedures refuse other workspaces", async () => {
    await expectCrossWorkspaceDenied("notes.list", {});
    await expectCrossWorkspaceDenied("notes.search", { query: "Sneaky" });
    await expectCrossWorkspaceDenied("notes.get", { noteId });
    await expectCrossWorkspaceDenied("notes.create", { title: "Sneaky" });
    await expectCrossWorkspaceDenied("notes.update", {
      noteId,
      title: "Sneaky",
    });
    await expectCrossWorkspaceDenied("notes.delete", { noteId });
    await expectCrossWorkspaceDenied("notes.comments.add", {
      noteId,
      body: "Sneaky",
    });
  });
});
