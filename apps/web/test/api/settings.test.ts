import { env as workerEnv } from "cloudflare:workers";
import { createMcpHandler } from "@modelcontextprotocol/server";
import type { APIContext } from "astro";
import { describe, expect, it } from "vitest";
import { GET as avatarGet } from "@/pages/api/account/avatar/[version]";
import { POST as avatarPost } from "@/pages/api/account/avatar/index";
import { GET as logoGet } from "@/pages/api/workspaces/[workspaceId]/logo/[version]";
import { POST as logoPost } from "@/pages/api/workspaces/[workspaceId]/logo/index";
import { createAuthOptions, getAuth } from "@/server/auth";
import { buildMcpServer } from "@/server/mcp/server";
import { invoke } from "@/server/mcp/tools";
import { buildPlatform } from "@/server/platform";
import {
  APP_URL,
  callerFor,
  env,
  expectCrossWorkspaceDenied,
  signUp,
  type TestUser,
  testRequestContext,
} from "./helpers";

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
function routeContext(
  user: TestUser | null,
  path: string,
  params: Record<string, string>,
  body?: Uint8Array,
  origin = APP_URL
) {
  return {
    request: new Request(`${APP_URL}${path}`, {
      method: body ? "POST" : "GET",
      ...(body
        ? {
            body: new Uint8Array(body).buffer,
            headers: { origin, "content-type": "image/png" },
          }
        : {}),
    }),
    params,
    locals: { user, requestContext: testRequestContext() },
  } as unknown as APIContext;
}

describe("account settings API and MCP", () => {
  it("updates only the current user's valid personal preferences", async () => {
    const user = await signUp("Settings Person", "settings@example.test");
    const other = await signUp("Other Settings", "settings-other@example.test");
    const caller = callerFor(user);
    expect(await caller.account.settings.get()).toMatchObject({
      theme: "system",
      timezone: "UTC",
      locale: "en",
    });
    expect(
      await caller.account.settings.update({
        theme: "dark",
        timezone: "Europe/Prague",
        locale: "cs-CZ",
      })
    ).toMatchObject({ theme: "dark", locale: "cs-CZ" });
    expect(await invoke(caller, "account.settings.get")).toMatchObject({
      theme: "dark",
    });
    expect(await callerFor(other).account.settings.get()).toMatchObject({
      theme: "system",
    });
    await expect(
      caller.account.settings.update({
        theme: "light",
        timezone: "not-a-zone",
        locale: "en",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(callerFor(null).account.settings.get()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("lists sessions without tokens and refuses cross-user revocation, including MCP", async () => {
    const user = await signUp(
      "Session Person",
      "session-settings@example.test"
    );
    const other = await signUp("Other Session", "session-other@example.test");
    const caller = callerFor(user);
    const sessions = await caller.account.sessions.list();
    expect(sessions.items).toHaveLength(1);
    expect(JSON.stringify(sessions)).not.toContain('"token"');
    const id = sessions.items[0]?.id as string;
    await expect(
      callerFor(other).account.sessions.revoke({ sessionId: id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await caller.account.sessions.list()).items).toHaveLength(1);
    expect(await caller.account.sessions.revoke({ sessionId: id })).toEqual({
      revoked: true,
    });
    expect((await caller.account.sessions.list()).items).toHaveLength(0);
  });

  it("uses Better Auth's browser revocation path without leaking tokens", async () => {
    const user = await signUp(
      "Browser Session",
      "browser-session@example.test"
    );
    const authSession = await getAuth(env).api.getSession({
      headers: new Headers({ cookie: user.cookie }),
    });
    const caller = callerFor(user, env, testRequestContext(), {
      session: {
        id: authSession?.session.id,
        createdAt: new Date(),
        impersonatedBy: null,
      },
      exchange: {
        headers: new Headers({ cookie: user.cookie, origin: APP_URL }),
        resHeaders: new Headers(),
      },
    });
    const sessions = await caller.account.sessions.list();
    expect(sessions.items[0]?.current).toBe(true);
    await caller.account.sessions.revoke({
      sessionId: sessions.items[0]?.id as string,
    });
    const refreshed = await getAuth(env).api.getSession({
      headers: new Headers({ cookie: user.cookie }),
      query: { disableCookieCache: true },
    });
    expect(refreshed).toBeNull();
  });

  it("stores, reads and removes private bounded raster avatars", async () => {
    const user = await signUp("Avatar Person", "avatar-settings@example.test");
    const other = await signUp("Other Avatar", "avatar-other@example.test");
    const posted = await avatarPost(
      routeContext(user, "/api/account/avatar", {}, png)
    );
    expect(posted.status).toBe(200);
    const { avatarUrl } = (await posted.json()) as { avatarUrl: string };
    const version = avatarUrl.split("/").at(-1) as string;
    const response = await avatarGet(
      routeContext(user, avatarUrl, { version })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("private");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(png);
    expect(
      (await avatarGet(routeContext(other, avatarUrl, { version }))).status
    ).toBe(404);
    expect(
      (
        await avatarPost(
          routeContext(
            user,
            "/api/account/avatar",
            {},
            png,
            "https://evil.example"
          )
        )
      ).status
    ).toBe(403);
    expect(
      (await avatarPost(routeContext(null, "/api/account/avatar", {}, png)))
        .status
    ).toBe(404);
    expect(
      (
        await avatarPost(
          routeContext(
            user,
            "/api/account/avatar",
            {},
            new Uint8Array(1024 * 1024 + 1)
          )
        )
      ).status
    ).toBe(400);
    expect(
      (
        await avatarPost(
          routeContext(
            user,
            "/api/account/avatar",
            {},
            new TextEncoder().encode("<svg/>")
          )
        )
      ).status
    ).toBe(400);
    await callerFor(user).account.removeAvatar();
    expect(
      (await avatarGet(routeContext(user, avatarUrl, { version }))).status
    ).toBe(404);
  });
});

describe("workspace settings", () => {
  it("renames, manages a logo and deletes only a confirmed shared workspace", async () => {
    const user = await signUp(
      "Workspace Settings",
      "workspace-settings@example.test"
    );
    const caller = callerFor(user);
    const shared = await caller.workspace.create({ name: "Design team" });
    expect(
      await caller.workspace.settings({ workspaceId: shared.id })
    ).toMatchObject({ name: "Design team", logoUrl: null });
    await caller.workspace.update({
      workspaceId: shared.id,
      name: "Product team",
    });
    const posted = await logoPost(
      routeContext(
        user,
        `/api/workspaces/${shared.id}/logo`,
        { workspaceId: shared.id },
        png
      )
    );
    expect(posted.status).toBe(200);
    const data = (await posted.json()) as { logoUrl: string };
    const version = data.logoUrl.split("/").at(-1) as string;
    const image = await logoGet(
      routeContext(user, data.logoUrl, { workspaceId: shared.id, version })
    );
    expect(image.status).toBe(200);
    await caller.workspace.removeLogo({ workspaceId: shared.id });
    expect(
      (await caller.workspace.settings({ workspaceId: shared.id })).logoUrl
    ).toBeNull();
    await expect(
      caller.workspace.delete({
        workspaceId: shared.id,
        confirmName: "Design team",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await caller.workspace.delete({
      workspaceId: shared.id,
      confirmName: "Product team",
    });
    expect(
      (await caller.workspace.list()).items.map((item) => item.id)
    ).not.toContain(shared.id);
  });
  it("checks cross-workspace access on every settings procedure", async () => {
    await expectCrossWorkspaceDenied("workspace.settings", {});
    await expectCrossWorkspaceDenied("workspace.update", { name: "Stolen" });
    await expectCrossWorkspaceDenied("workspace.delete", {
      confirmName: "Wrong",
    });
    await expectCrossWorkspaceDenied("workspace.removeLogo", {});
  });
  it("refuses member mutations and image writes into another workspace", async () => {
    const owner = await signUp("Settings Owner", "settings-owner@example.test");
    const member = await signUp(
      "Settings Member",
      "settings-member@example.test"
    );
    const team = await callerFor(owner).workspace.create({
      name: "Private team",
    });
    expect(
      (
        await logoPost(
          routeContext(
            member,
            `/api/workspaces/${team.id}/logo`,
            { workspaceId: team.id },
            png
          )
        )
      ).status
    ).toBe(404);
    await workerEnv.DB.prepare(
      "INSERT INTO workspace_members (workspace_id,user_id,role) VALUES (?,?,'member')"
    )
      .bind(team.id, member.id)
      .run();
    const caller = callerFor(member);
    expect(
      await caller.workspace.settings({ workspaceId: team.id })
    ).toMatchObject({ name: "Private team" });
    await expect(
      caller.workspace.update({ workspaceId: team.id, name: "No" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.workspace.delete({
        workspaceId: team.id,
        confirmName: "Private team",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(
      (
        await logoPost(
          routeContext(
            member,
            `/api/workspaces/${team.id}/logo`,
            { workspaceId: team.id },
            png
          )
        )
      ).status
    ).toBe(403);
  });
});

describe("Better Auth account-management configuration", () => {
  it("requires verified email changes and same-email linking while self-deletion stays disabled", () => {
    const options = createAuthOptions(env);
    expect(options.user.changeEmail.enabled).toBe(true);
    expect(options.user.changeEmail.updateEmailWithoutVerification).toBe(false);
    expect(options.account.accountLinking).toMatchObject({
      allowDifferentEmails: false,
      allowUnlinkingAll: false,
    });
    expect(options.user.deleteUser.enabled).toBe(false);
    expect(options.session.freshAge).toBe(900);
  });
  it("keeps native self-deletion unavailable until the privacy pipeline lands", async () => {
    const user = await signUp(
      "Delete Settings",
      "delete-settings@example.test"
    );
    const deleted = await getAuth(env).handler(
      new Request(`${APP_URL}/api/auth/delete-user`, {
        method: "POST",
        headers: {
          cookie: user.cookie,
          origin: APP_URL,
          "content-type": "application/json",
        },
        body: JSON.stringify({ password: "test-password-1234" }),
      })
    );
    expect(deleted.status).toBe(404);
    expect(
      await workerEnv.DB.prepare("SELECT id FROM user WHERE id = ?")
        .bind(user.id)
        .first()
    ).not.toBeNull();
    expect(
      (
        await workerEnv.DB.prepare("SELECT id FROM session WHERE user_id = ?")
          .bind(user.id)
          .all()
      ).results.length
    ).toBeGreaterThan(0);
  });
});

async function mcpCall(
  caller: ReturnType<typeof callerFor>,
  name: string,
  args: Record<string, unknown> = {}
) {
  const handler = createMcpHandler(() =>
    buildMcpServer(() => caller, {
      errors: buildPlatform(env).errors,
      tracer: buildPlatform(env).tracer.withContext(testRequestContext()),
      requestContext: testRequestContext(),
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
    structuredContent: Record<string, unknown> & {
      error?: { code: string; message: string };
    };
  };
}

describe("settings tools through MCP", () => {
  it("uses the registered tools with the same authorization and never returns session credentials", async () => {
    const user = await signUp("MCP Settings", "mcp-settings@example.test");
    const caller = callerFor(user);
    const before = await mcpCall(caller, "get_account_settings");
    expect(before.isError).not.toBe(true);
    expect(before.structuredContent).toMatchObject({ theme: "system" });
    const saved = await mcpCall(caller, "update_account_settings", {
      theme: "light",
      locale: "en-GB",
      timezone: "Europe/London",
    });
    expect(saved.isError).not.toBe(true);
    expect(saved.structuredContent).toMatchObject({ theme: "light" });
    const listed = await mcpCall(caller, "list_sessions");
    expect(listed.isError).not.toBe(true);
    expect(JSON.stringify(listed)).not.toContain('"token"');
    const [session] = listed.structuredContent.items as { id: string }[];
    const revoked = await mcpCall(caller, "revoke_session", {
      sessionId: session?.id,
    });
    expect(revoked.isError).not.toBe(true);
    const anonymous = await mcpCall(callerFor(null), "get_account_settings");
    expect(anonymous.isError).toBe(true);
  });
});
