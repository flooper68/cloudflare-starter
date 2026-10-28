import { env as workerEnv } from "cloudflare:workers";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { beforeAll, describe, expect, it } from "vitest";

import {
  getAuth,
  IMPERSONATION_OAUTH_REFUSED,
  mcpResource,
} from "@/server/auth";
import type { AppEnv } from "@/server/env";
import { handleMcp } from "@/server/mcp/handler";
import { buildMcpServer } from "@/server/mcp/server";
import { invoke, PROCEDURE_PATHS } from "@/server/mcp/tools";
import { buildPlatform } from "@/server/platform";
import { serializeBootstrap, spaBootstrap } from "@/server/spa-bootstrap";

import {
  APP_URL,
  browserCallerFor,
  callerFor,
  envWith,
  humanHeaders,
  mailEnv,
  outbox,
  signUp,
  signUpRequest,
  type TestUser,
  testRequestContext,
} from "./helpers";

const env = workerEnv as AppEnv;
const ADMIN_PATHS = PROCEDURE_PATHS.filter((path) => path.startsWith("admin."));

async function sql(query: string, ...params: unknown[]) {
  await env.DB.prepare(query)
    .bind(...params)
    .run();
}

async function makeAdmin(user: TestUser) {
  await sql("UPDATE user SET role = 'admin' WHERE id = ?", user.id);
}

/** Cookies a response set, as a request `cookie` header. */
function cookiesFrom(headers: Headers): string {
  return headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter((pair) => !pair?.endsWith("="))
    .join("; ");
}

async function sessionOfCookie(cookie: string) {
  return getAuth(env).api.getSession({
    headers: new Headers({ cookie }),
    query: { disableCookieCache: true },
  });
}

function signIn(email: string, ip = "198.51.100.20") {
  return getAuth(env).handler(
    new Request(`${APP_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: APP_URL,
        ...humanHeaders(ip),
      },
      body: JSON.stringify({ email, password: "test-password-1234" }),
    })
  );
}

async function mcpCall(
  caller: ReturnType<typeof callerFor>,
  name: string,
  args: Record<string, unknown> = {}
) {
  const handler = createMcpHandler(() =>
    buildMcpServer(caller, {
      errors: buildPlatform(env).errors,
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

let admin: TestUser;
let grace: TestUser;
let alan: TestUser;
let member: TestUser;

beforeAll(async () => {
  admin = await signUp("Ada Admin", "ada@admin.test");
  grace = await signUp("Grace Hopper", "grace@acme.test");
  alan = await signUp("Alan Turing", "alan@acme.test");
  member = await signUp("Mia Member", "mia@acme.test");
  await makeAdmin(admin);
});

describe("admin portal access", () => {
  it("finds the admin procedures", () => {
    expect(ADMIN_PATHS.length).toBeGreaterThan(15);
  });

  it("answers NOT_FOUND to anonymous callers and non-admins for every admin procedure", async () => {
    for (const path of ADMIN_PATHS) {
      await expect(
        invoke(callerFor(null), path, {}),
        path
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        invoke(browserCallerFor(member).caller, path, {}),
        path
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
  });

  it("answers NOT_FOUND to admins too when ADMIN_PORTAL=off", async () => {
    const off = envWith({ WORKSPACE_MODE: "multi", ADMIN_PORTAL: "off" });
    for (const path of ADMIN_PATHS) {
      await expect(
        invoke(browserCallerFor(admin, { runtimeEnv: off }).caller, path, {}),
        path
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
  });

  it("closes Better Auth's admin HTTP endpoints", async () => {
    for (const path of [
      "/admin/list-users",
      "/admin/ban-user",
      "/admin/impersonate-user",
    ]) {
      const response = await getAuth(env).handler(
        new Request(`${APP_URL}/api/auth${path}`, {
          method: path === "/admin/list-users" ? "GET" : "POST",
          headers: {
            "content-type": "application/json",
            origin: APP_URL,
            cookie: admin.cookie,
          },
          body:
            path === "/admin/list-users"
              ? undefined
              : JSON.stringify({ userId: grace.id }),
        })
      );
      expect(response.status, path).toBe(404);
    }
  });
});

describe("admin procedures", () => {
  it("reads: overview, settings, users, user detail, audit", async () => {
    const { caller } = browserCallerFor(admin);
    const overview = await caller.admin.overview.get();
    expect(overview.users.total).toBeGreaterThanOrEqual(4);
    expect(overview.users.admins).toBe(1);
    expect(overview.plans).toBeNull();

    expect(await caller.admin.settings.get()).toMatchObject({
      environment: "develop",
      workspaceMode: "multi",
      signUp: "open",
      signInMethods: ["email_password"],
      adminPortal: "on",
    });

    const users = await caller.admin.users.list({ search: "acme.test" });
    expect(users.items.map((u) => u.email).sort()).toEqual([
      "alan@acme.test",
      "grace@acme.test",
      "mia@acme.test",
    ]);
    const detail = await caller.admin.users.get({ userId: grace.id });
    expect(detail).toMatchObject({
      email: "grace@acme.test",
      role: "user",
      signInMethods: ["credential"],
    });
    expect(detail.workspaces).toHaveLength(1);
    expect(detail.sessions.length).toBeGreaterThan(0);

    const audit = await caller.admin.audit.list({ action: "auth.sign_up" });
    expect(audit.events.length).toBeGreaterThanOrEqual(4);
  });

  it("asks for a recent sign-in before destructive actions (REAUTH_REQUIRED)", async () => {
    const { caller } = browserCallerFor(admin, { signedInMinutesAgo: 16 });
    await expect(
      caller.admin.users.revokeSessions({ userId: alan.id })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      cause: { code: "REAUTH_REQUIRED" },
    });
    // The tRPC response carries the code for clients to branch on.
    const response = await workerEnvFetchTrpc("admin.users.revokeSessions", {
      userId: alan.id,
    });
    expect(response.error?.data?.appCode).toBe("REAUTH_REQUIRED");
  });

  it("suspends a user: sessions end, sign-in is refused, then lifted", async () => {
    const { caller } = browserCallerFor(admin);
    await caller.admin.users.ban({ userId: alan.id, reason: "Spam" });
    expect(await sessionOfCookie(alan.cookie)).toBeNull();

    const refused = await signIn(alan.email);
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ code: "BANNED_USER" });
    expect(
      (await caller.admin.users.list({ status: "banned" })).items.map(
        (u) => u.id
      )
    ).toEqual([alan.id]);

    await caller.admin.users.unban({ userId: alan.id });
    expect((await signIn(alan.email, "198.51.100.21")).status).toBe(200);
    const events = await caller.admin.audit.list({
      targetType: "user",
      targetId: alan.id,
    });
    expect(events.events.map((e) => e.action)).toEqual(
      expect.arrayContaining([
        "user.banned",
        "user.sessions_revoked",
        "user.unbanned",
      ])
    );
  });

  it("roles, sessions, password reset; refuses acting on yourself and the last admin", async () => {
    const { caller } = browserCallerFor(admin);
    await expect(
      caller.admin.users.setRole({ userId: admin.id, role: "user" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.admin.users.ban({ userId: admin.id })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await caller.admin.users.setRole({ userId: grace.id, role: "admin" });
    const asGrace = browserCallerFor(grace).caller;
    expect((await asGrace.admin.users.get({ userId: admin.id })).role).toBe(
      "admin"
    );
    await caller.admin.users.setRole({ userId: grace.id, role: "user" });
    await expect(
      asGrace.admin.users.get({ userId: admin.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(
      await caller.admin.users.revokeSessions({ userId: member.id })
    ).toMatchObject({ userId: member.id });

    const mailCaller = browserCallerFor(admin, { runtimeEnv: mailEnv }).caller;
    const before = outbox.length;
    expect(
      await mailCaller.admin.users.sendPasswordReset({ userId: grace.id })
    ).toEqual({ userId: grace.id, email: grace.email });
    expect(outbox.length).toBe(before + 1);
    expect(outbox.at(-1)?.text).toContain("/reset-password");
  });

  it("workspaces: list, detail, assign an owner, delete", async () => {
    const { caller } = browserCallerFor(admin);
    const team = await callerFor(member).workspace.create({
      name: "Rescue Team",
    });
    await sql(
      "UPDATE workspace_members SET role = 'member' WHERE workspace_id = ?",
      team.id
    );
    const list = await caller.admin.workspaces.list({ search: "Rescue" });
    expect(list.items).toMatchObject([
      { id: team.id, memberCount: 1, managerCount: 0 },
    ]);
    expect(
      (await caller.admin.workspaces.get({ workspaceId: team.id })).managerCount
    ).toBe(0);
    await caller.admin.workspaces.assignOwner({
      workspaceId: team.id,
      userId: grace.id,
    });
    expect(
      (await caller.admin.workspaces.get({ workspaceId: team.id })).managerCount
    ).toBe(1);
    await caller.admin.workspaces.delete({ workspaceId: team.id });
    await expect(
      caller.admin.workspaces.get({ workspaceId: team.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("removes a user and their personal workspace", async () => {
    const temp = await signUp("Tim Temporary", "tim@acme.test");
    const { caller } = browserCallerFor(admin);
    const removed = await caller.admin.users.remove({ userId: temp.id });
    expect(removed.deletedWorkspaceIds).toHaveLength(1);
    await expect(
      caller.admin.users.get({ userId: temp.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("impersonation", () => {
  it("swaps the browser session to the user and back, recorded both ways", async () => {
    const start = browserCallerFor(admin);
    expect(
      await start.caller.admin.impersonation.start({ userId: member.id })
    ).toEqual({ userId: member.id });
    const asUser = cookiesFrom(start.resHeaders);
    const impersonated = await sessionOfCookie(asUser);
    expect(impersonated?.user.id).toBe(member.id);
    expect(impersonated?.session.impersonatedBy).toBe(admin.id);
    // The impersonated session is not an admin's: the portal is closed to it.
    const memberUser = { ...member, cookie: asUser };
    await expect(
      browserCallerFor(memberUser, {
        impersonatedBy: admin.id,
      }).caller.admin.users.list({})
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    // What the admin does as the user is recorded as the user, with the admin as impersonator.
    const created = await browserCallerFor(memberUser, {
      impersonatedBy: admin.id,
    }).caller.workspace.create({ name: "Made While Impersonating" });
    expect(
      await env.DB.prepare(
        "SELECT actor_user_id AS actor, impersonator_user_id AS impersonator FROM audit_events WHERE action = 'workspace.created' AND workspace_id = ?"
      )
        .bind(created.id)
        .first()
    ).toEqual({ actor: member.id, impersonator: admin.id });

    const stop = browserCallerFor(memberUser, { impersonatedBy: admin.id });
    expect(await stop.caller.admin.impersonation.stop()).toEqual({
      adminUserId: admin.id,
    });
    const restored = await sessionOfCookie(cookiesFrom(stop.resHeaders));
    expect(restored?.user.id).toBe(admin.id);

    const events = await browserCallerFor(admin).caller.admin.audit.list({
      targetType: "user",
      targetId: member.id,
    });
    expect(events.events.map((e) => e.action)).toEqual(
      expect.arrayContaining(["impersonation.started", "impersonation.stopped"])
    );
  });

  it("refuses OAuth (MCP) authorization and consent from an impersonation session, recorded", async () => {
    const start = browserCallerFor(admin);
    await start.caller.admin.impersonation.start({ userId: member.id });
    const asUser = cookiesFrom(start.resHeaders);
    const auth = (path: string, init: RequestInit = {}) =>
      getAuth(env).handler(
        new Request(`${APP_URL}/api/auth${path}`, {
          ...init,
          headers: {
            "content-type": "application/json",
            origin: APP_URL,
            cookie: asUser,
          },
        })
      );

    const consent = await auth("/oauth2/consent", {
      method: "POST",
      body: JSON.stringify({ accept: true }),
    });
    expect(consent.status).toBe(403);
    expect(await consent.json()).toMatchObject({
      code: IMPERSONATION_OAUTH_REFUSED,
    });
    const authorize = await auth(
      "/oauth2/authorize?client_id=claude-test&response_type=code&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcallback"
    );
    expect(authorize.status).toBe(403);

    const events = await browserCallerFor(admin).caller.admin.audit.list({
      action: "impersonation.oauth_refused",
    });
    expect(events.events[0]).toMatchObject({
      outcome: "failure",
      actor: { kind: "admin", userId: admin.id },
      target: { type: "user", id: member.id },
      metadata: { clientId: "claude-test" },
    });

    await browserCallerFor(
      { ...member, cookie: asUser },
      { impersonatedBy: admin.id }
    ).caller.admin.impersonation.stop();
  });

  it("refuses admins as targets, and stop outside an impersonation", async () => {
    const { caller } = browserCallerFor(admin);
    const other = await signUp("Olga Admin", "olga@admin.test");
    await makeAdmin(other);
    await expect(
      caller.admin.impersonation.start({ userId: other.id })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.impersonation.stop()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("the human check stays on for HTTP (in-process reset links are exempt)", () => {
  const post = (path: string, body: unknown, headers = {}) =>
    getAuth(env).handler(
      new Request(`${APP_URL}/api/auth${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: APP_URL,
          "cf-connecting-ip": "198.51.100.77",
          ...headers,
        },
        body: JSON.stringify(body),
      })
    );

  it.each([
    [
      "/sign-up/email",
      { name: "Bot", email: "bot@spam.test", password: "test-password-1234" },
    ],
    [
      "/sign-in/email",
      {
        email: grace?.email ?? "grace@acme.test",
        password: "test-password-1234",
      },
    ],
    [
      "/request-password-reset",
      { email: "grace@acme.test", redirectTo: "/reset-password" },
    ],
    [
      "/request-password-reset?internal=1",
      { email: "grace@acme.test", redirectTo: "/reset-password" },
    ],
  ])("HTTP %s without a token is refused", async (path, body) => {
    const response = await post(path, body, {
      // Nothing a client sends turns the exemption on.
      "x-forwarded-for": "127.0.0.1",
      "x-trpc-source": "app",
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "HUMAN_CHECK_FAILED" });
  });

  it("in-process sign-up through auth.api is still checked; only the reset link is exempt", async () => {
    await expect(
      getAuth(env).api.signUpEmail({
        body: {
          name: "Server Side",
          email: "server-side@acme.test",
          password: "test-password-1234",
        },
      })
    ).rejects.toMatchObject({ body: { code: "HUMAN_CHECK_FAILED" } });
    await expect(
      getAuth(mailEnv).api.requestPasswordReset({
        body: { email: "grace@acme.test", redirectTo: "/reset-password" },
      })
    ).resolves.toBeTruthy();
  });
});

describe("/admin and /app pages (spaBootstrap)", () => {
  type Locals = Parameters<typeof spaBootstrap>[1];
  const locals = (
    user: TestUser | null,
    impersonatedBy: string | null = null
  ): Locals =>
    ({
      user: user
        ? { id: user.id, name: user.name, email: user.email, image: null }
        : null,
      session: user ? { impersonatedBy } : null,
    }) as unknown as Locals;

  it("opens the portal to active admins with ADMIN_PORTAL=on only", async () => {
    const off = envWith({ WORKSPACE_MODE: "multi", ADMIN_PORTAL: "off" });
    expect((await spaBootstrap(env, locals(null))).admin).toBe(false);
    expect((await spaBootstrap(env, locals(member))).admin).toBe(false);
    expect((await spaBootstrap(env, locals(admin))).admin).toBe(true);
    expect((await spaBootstrap(off, locals(admin))).admin).toBe(false);

    const sam = await signUp("Sam Suspended", "sam@admin.test");
    await sql(
      "UPDATE user SET role = 'admin', banned = 1 WHERE id = ?",
      sam.id
    );
    expect((await spaBootstrap(env, locals(sam))).admin).toBe(false);
  });

  it("tells the app about an impersonation (the banner)", async () => {
    const bootstrap = await spaBootstrap(env, locals(member, admin.id));
    expect(bootstrap).toMatchObject({ admin: false, impersonatedBy: admin.id });
  });

  it("serializes user data so it cannot close the script tag", async () => {
    const hostile = await spaBootstrap(env, {
      ...locals(member),
      user: {
        id: member.id,
        name: "</script><script>alert(1)</script>\u2028",
        email: member.email,
        image: null,
      },
    } as unknown as Locals);
    const html = serializeBootstrap(hostile);
    expect(html).not.toContain("</script");
    expect(html).not.toContain("<");
    expect(JSON.parse(html)).toEqual(JSON.parse(JSON.stringify(hostile)));
  });
});

describe("BOOTSTRAP_ADMIN_EMAIL", () => {
  it("becomes an admin once the address is verified, recorded as the system", async () => {
    const bootstrapEnv = envWith({
      WORKSPACE_MODE: "multi",
      BOOTSTRAP_ADMIN_EMAIL: "founder@bootstrap.test",
    });
    const response = await signUpRequest(
      "Fay Founder",
      "founder@bootstrap.test",
      bootstrapEnv
    );
    expect(response.ok).toBe(true);
    const { user } = (await response.json()) as { user: { id: string } };
    const role = async () =>
      (
        await env.DB.prepare("SELECT role FROM user WHERE id = ?")
          .bind(user.id)
          .first<{ role: string }>()
      )?.role;
    expect(await role()).toBe("user");

    const mail = outbox.findLast((sent) =>
      JSON.stringify(sent.to).includes("founder@bootstrap.test")
    );
    const link = /(http\S+verify-email\S+)/.exec(mail?.text ?? "")?.[1];
    expect(link).toBeDefined();
    await getAuth(bootstrapEnv).handler(new Request(link as string));
    expect(await role()).toBe("admin");

    const audit = await browserCallerFor(admin).caller.admin.audit.list({
      action: "user.role_changed",
      targetType: "user",
      targetId: user.id,
    });
    expect(audit.events).toMatchObject([
      {
        actor: { kind: "system" },
        metadata: { previousRole: "user", role: "admin" },
      },
    ]);

    // Another admin demotes the founder; later updates (a ban, its lifting) keep it so.
    const asAdmin = browserCallerFor(admin, {
      runtimeEnv: bootstrapEnv,
    }).caller;
    await asAdmin.admin.users.setRole({ userId: user.id, role: "user" });
    await asAdmin.admin.users.ban({ userId: user.id });
    await asAdmin.admin.users.unban({ userId: user.id });
    expect(await role()).toBe("user");
  });
});

describe("suspension and MCP access tokens", () => {
  it("a suspended user's access token stops working at /mcp", async () => {
    const bea = await signUp("Bea Banned", "bea@acme.test");
    const { token } = await getAuth(env).api.signJWT({
      body: {
        payload: {
          sub: bea.id,
          azp: "test-client",
          aud: mcpResource(APP_URL),
          iss: `${APP_URL}/api/auth`,
        },
      },
    });
    const call = () =>
      handleMcp(
        new Request(`${APP_URL}/mcp`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
          },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
        }),
        env,
        testRequestContext()
      );
    expect((await call()).status).toBe(200);
    await browserCallerFor(admin).caller.admin.users.ban({ userId: bea.id });
    expect((await call()).status).toBe(401);
  });
});

describe("admin tools through /mcp", () => {
  it("every admin tool works for an admin with a recent sign-in", async () => {
    const asAdmin = callerFor(admin);
    const ok = async (name: string, args: Record<string, unknown> = {}) => {
      const result = await mcpCall(asAdmin, name, args);
      expect(result.isError, `${name}: ${JSON.stringify(result)}`).toBeFalsy();
      return result.structuredContent;
    };
    // A fresh sign-in for the MCP recent-sign-in check (the admin's newest session).
    await signIn(admin.email, "198.51.100.30");
    const target = await signUp("Tara Target", "tara@acme.test");

    expect(await ok("admin_get_overview")).toHaveProperty("users");
    expect(await ok("admin_get_settings")).toMatchObject({ adminPortal: "on" });
    expect(await ok("admin_list_users", { search: "tara" })).toMatchObject({
      items: [{ id: target.id }],
    });
    expect(await ok("admin_get_user", { userId: target.id })).toMatchObject({
      email: "tara@acme.test",
    });
    await ok("admin_set_user_role", { userId: target.id, role: "admin" });
    await ok("admin_set_user_role", { userId: target.id, role: "user" });
    await ok("admin_revoke_user_sessions", { userId: target.id });
    await ok("admin_ban_user", {
      userId: target.id,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    await ok("admin_unban_user", { userId: target.id });
    await ok("admin_send_password_reset", { userId: target.id });
    const team = await callerFor(target).workspace.create({ name: "MCP Team" });
    expect(await ok("admin_list_workspaces", { search: "MCP" })).toMatchObject({
      items: [{ id: team.id }],
    });
    expect(
      await ok("admin_get_workspace", { workspaceId: team.id })
    ).toMatchObject({ managerCount: 1 });
    await sql("DELETE FROM workspace_members WHERE workspace_id = ?", team.id);
    await ok("admin_assign_workspace_owner", {
      workspaceId: team.id,
      userId: grace.id,
    });
    await ok("admin_delete_workspace", { workspaceId: team.id });
    await ok("admin_remove_user", { userId: target.id });
    const audit = await ok("admin_list_audit_events", {
      targetType: "user",
      targetId: target.id,
    });
    expect(
      (audit.events as { action: string }[]).map((e) => e.action)
    ).toContain("user.deleted");
  });

  it("MCP: non-admins get NOT_FOUND, stale admins REAUTH_REQUIRED", async () => {
    const denied = await mcpCall(callerFor(member), "admin_list_users");
    expect(denied.structuredContent.error?.code).toBe("NOT_FOUND");

    await sql(
      "UPDATE session SET created_at = ? WHERE user_id = ?",
      Date.now() - 60 * 60 * 1000,
      admin.id
    );
    const stale = await mcpCall(
      callerFor(admin),
      "admin_revoke_user_sessions",
      {
        userId: grace.id,
      }
    );
    expect(stale.structuredContent.error).toMatchObject({ code: "FORBIDDEN" });
    expect(stale.structuredContent.error?.message).toMatch(/Sign in again/);
    // Reads stay available.
    expect(
      (await mcpCall(callerFor(admin), "admin_get_overview")).isError
    ).toBeFalsy();
  });
});

/** A tRPC call through the HTTP formatter, to read `data.appCode`. */
async function workerEnvFetchTrpc(path: string, input: unknown) {
  const { fetchRequestHandler } = await import("@trpc/server/adapters/fetch");
  const { appRouter } = await import("@/server/trpc/router");
  const { createAppContext } = await import("@/server/trpc/context");
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: new Request(`${APP_URL}/api/trpc/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-trpc-source": "app" },
      body: JSON.stringify(input),
    }),
    router: appRouter,
    createContext: () =>
      createAppContext(
        { id: admin.id, email: admin.email, name: admin.name },
        testRequestContext(),
        env,
        {
          session: {
            createdAt: new Date(Date.now() - 60 * 60 * 1000),
            impersonatedBy: null,
          },
          exchange: null,
        }
      ),
  });
  return (await response.json()) as {
    error?: { data?: { appCode?: string } };
  };
}
