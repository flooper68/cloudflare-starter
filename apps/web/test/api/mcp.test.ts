import { env } from "cloudflare:workers";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";

import { handleMcp } from "@/server/mcp/handler";
import { buildMcpServer } from "@/server/mcp/server";
import { buildPlatform } from "@/server/platform";

import {
  APP_URL,
  callerFor,
  invitationToken,
  inviteByMail,
  mailEnv,
  signUp,
  testRequestContext,
} from "./helpers";

async function rpc(
  caller: ReturnType<typeof callerFor>,
  method: string,
  params: unknown = {},
  requestContext = testRequestContext()
) {
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
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    })
  );
  const text = await response.text();
  const json = text.startsWith("{")
    ? text
    : (text.split("\n").find((line) => line.startsWith("data: ")) ?? "").slice(
        6
      );
  return JSON.parse(json);
}

describe("/mcp", () => {
  it("challenges requests without a token, pointing at the resource metadata", async () => {
    const response = await handleMcp(
      new Request(`${APP_URL}/mcp`, { method: "POST", body: "{}" }),
      env,
      testRequestContext()
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain(
      `resource_metadata="${APP_URL}/.well-known/oauth-protected-resource/mcp"`
    );
  });

  it("rejects a token that is not a valid access token", async () => {
    const response = await handleMcp(
      new Request(`${APP_URL}/mcp`, {
        method: "POST",
        headers: { authorization: "Bearer not-a-jwt" },
        body: "{}",
      }),
      env,
      testRequestContext()
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain(
      'error="invalid_token"'
    );
  });

  it("tools act as the user against the real database", async () => {
    const user = await signUp("Nicole Example", "nicole@example.test");
    const caller = callerFor(user);

    const whoami = await rpc(caller, "tools/call", {
      name: "whoami",
      arguments: {},
    });
    expect(whoami.result.structuredContent.user).toBe("nicole@example.test");

    const files = await rpc(caller, "tools/call", {
      name: "list_files",
      arguments: {},
    });
    expect(files.result.structuredContent).toEqual({ items: [] });

    const queued = await rpc(caller, "tools/call", {
      name: "enqueue_hello",
      arguments: { name: "from MCP" },
    });
    expect(queued.result.structuredContent).toEqual({
      queued: true,
      jobId: expect.any(String),
    });
  });

  it("workspace tools: create, invite, accept, members, roles, transfer, leave", async () => {
    const owner = await signUp("Ada Lovelace", "ada@acme.test");
    const guest = await signUp("Grace Hopper", "grace@acme.test");
    const asOwner = callerFor(owner, mailEnv);
    const asGuest = callerFor(guest);
    const call = async (
      caller: ReturnType<typeof callerFor>,
      name: string,
      args: Record<string, unknown> = {}
    ) => {
      const response = await rpc(caller, "tools/call", {
        name,
        arguments: args,
      });
      expect(response.result.isError, JSON.stringify(response)).toBeFalsy();
      return response.result.structuredContent;
    };

    const team = await call(asOwner, "create_workspace", { name: "Acme" });
    expect(team).toMatchObject({ kind: "shared", role: "owner" });
    const workspaces = await call(asOwner, "list_workspaces");
    expect(workspaces).toMatchObject({
      mode: "multi",
      activeWorkspaceId: team.id,
    });

    const invited = await call(asOwner, "invite_member", {
      email: guest.email,
      role: "member",
    });
    expect(invited).toMatchObject({
      email: "grace@acme.test",
      delivered: true,
    });
    const pending = await call(asOwner, "list_invitations");
    expect(pending.items).toHaveLength(1);

    const token = invitationToken(guest.email);
    expect(await call(asGuest, "preview_invitation", { token })).toMatchObject({
      workspaceName: "Acme",
      status: "pending",
    });
    expect(await call(asGuest, "accept_invitation", { token })).toEqual({
      workspaceId: team.id,
    });

    const members = await call(asGuest, "list_members");
    expect(members.items.map((m: { email: string }) => m.email)).toEqual([
      "ada@acme.test",
      "grace@acme.test",
    ]);
    expect(
      await call(asOwner, "change_member_role", {
        userId: guest.id,
        role: "owner",
      })
    ).toEqual({ userId: guest.id, role: "owner" });
    await call(asOwner, "change_member_role", {
      userId: guest.id,
      role: "member",
    });
    expect(
      await call(asOwner, "transfer_ownership", { userId: guest.id })
    ).toEqual({ ownerUserId: guest.id });

    const again = await call(asGuest, "invite_member", {
      email: "alan@acme.test",
      role: "member",
    });
    expect(
      await call(asGuest, "revoke_invitation", { invitationId: again.id })
    ).toEqual({ revoked: true });
    expect(await call(asOwner, "leave_workspace")).toEqual({ left: true });
    const personal = (await call(asOwner, "list_workspaces")).items[0];
    expect(
      await call(asOwner, "switch_workspace", { workspaceId: personal.id })
    ).toEqual({ workspaceId: personal.id });

    const second = await signUp("Alan Turing", "alan@acme.test");
    const token2 = await inviteByMail(guest, team.id, second.email);
    await callerFor(second).workspace.invitations.accept({ token: token2 });
    expect(await call(asGuest, "remove_member", { userId: second.id })).toEqual(
      { removed: true }
    );
  });

  it("marks tools that remove access as destructive and invitations as outward", async () => {
    const user = await signUp("Ken Thompson", "ken@example.test");
    const listed = await rpc(callerFor(user), "tools/list");
    const tool = (name: string) =>
      listed.result.tools.find((t: { name: string }) => t.name === name);
    for (const name of [
      "remove_member",
      "leave_workspace",
      "revoke_invitation",
    ]) {
      expect(tool(name).annotations.destructiveHint).toBe(true);
    }
    expect(tool("invite_member").annotations.openWorldHint).toBe(true);
    expect(tool("switch_workspace").inputSchema.required).toEqual([
      "workspaceId",
    ]);
    expect(Object.keys(tool("list_members").inputSchema.properties)).toEqual([
      "workspaceId",
    ]);
  });
});
