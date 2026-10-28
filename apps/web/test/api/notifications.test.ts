/**
 * Notifications end to end in workerd: a producer (accepting an invitation) sends through
 * `notify`, the queue consumer runs the dispatch and email jobs, the recipient reads the
 * inbox through tRPC and /mcp, and the one-click unsubscribe route (RFC 8058) turns mail
 * off. Jobs go to a memory queue and are run with the real consumer, so the test controls
 * when they run.
 */
import { createMessageBatch } from "cloudflare:test";
import { env as workerEnv } from "cloudflare:workers";
import {
  createMemoryEmail,
  createMemoryJobQueue,
  deriveUnsubscribeKey,
  type MemoryJobQueue,
  type Notify,
  notify,
  randomIds,
  signUnsubscribeToken,
  systemClock,
} from "@cloudflare-starter/features";
import { createMcpHandler } from "@modelcontextprotocol/server";
import type { APIContext } from "astro";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { buildRequiredConfig } from "@/lib/env";
import {
  GET as unsubscribeGet,
  POST as unsubscribePost,
} from "@/pages/api/notifications/unsubscribe";
import { getAuth } from "@/server/auth";
import { getDb } from "@/server/db";
import type { AppEnv } from "@/server/env";
import { withRequestContext } from "@/server/http";
import { buildMcpServer } from "@/server/mcp/server";
import { buildPlatform } from "@/server/platform";
import { handleQueueBatch, queueDeps } from "@/server/queue";
import { createAppContext } from "@/server/trpc/context";
import { appRouter } from "@/server/trpc/router";

import {
  APP_URL,
  callerFor,
  env,
  humanHeaders,
  inviteByMail,
  signUp,
  type TestUser,
  testRequestContext,
} from "./helpers";

const email = createMemoryEmail();

/** The tRPC caller of `user` whose jobs go to `queue` instead of APP_QUEUE. */
function callerWithQueue(user: TestUser, queue: MemoryJobQueue) {
  const base = createAppContext(
    { id: user.id, email: user.email, name: user.name },
    { ...testRequestContext(), userId: user.id },
    env
  );
  const bound: Notify = (definition, input) =>
    notify(
      { jobQueue: queue, clock: systemClock, ids: randomIds },
      definition,
      input
    );
  return appRouter.createCaller({ ...base, jobQueue: queue, notify: bound });
}

/** Runs every job in `queue` (and the jobs they enqueue) with the real consumer. */
async function drain(queue: MemoryJobQueue) {
  const platform = { ...buildPlatform(env), jobQueue: queue, email };
  let done = 0;
  while (done < queue.sent.length) {
    const pending = queue.sent.slice(done);
    done = queue.sent.length;
    const batch = createMessageBatch("cloudflare-starter-develop", [
      ...pending.map((sent, index) => ({
        id: `m-${done}-${index}`,
        timestamp: Date.now(),
        attempts: 1,
        body: sent.envelope,
      })),
    ]);
    await handleQueueBatch(batch, platform, queueDeps(env));
  }
}

async function rpc(
  user: TestUser,
  name: string,
  args: Record<string, unknown> = {}
) {
  const requestContext = testRequestContext();
  const handler = createMcpHandler(() =>
    buildMcpServer(() => callerFor(user), {
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
  const body = JSON.parse(json) as {
    result: { isError?: boolean; content: { text: string }[] };
  };
  return body.result;
}

let owner: TestUser;
let invitee: TestUser;

beforeAll(async () => {
  owner = await signUp("Ada Lovelace", "ada@notifications.test");
  invitee = await signUp("Grace Hopper", "grace@notifications.test");
  const queue = createMemoryJobQueue();
  const workspace = await callerFor(owner).workspace.create({
    name: "Analytical Engines",
  });
  const token = await inviteByMail(owner, workspace.id, invitee.email);
  await callerWithQueue(invitee, queue).workspace.invitations.accept({ token });
  expect(queue.sent.map((sent) => sent.envelope.type)).toEqual([
    "notifications.dispatch",
  ]);
  await drain(queue);
});

describe("notifications", () => {
  it("an accepted invitation reaches the owner's inbox and mail, with RFC 8058 headers", async () => {
    const caller = callerFor(owner);
    expect(await caller.notifications.unreadCount()).toEqual({ count: 1 });
    const page = await caller.notifications.list({ view: "inbox", limit: 10 });
    expect(page.items).toEqual([
      expect.objectContaining({
        type: "workspaces.member-joined",
        title: "Grace Hopper joined Analytical Engines",
        href: "/app/members",
        readAt: null,
      }),
    ]);
    // The joiner gets nothing about their own action.
    expect(await callerFor(invitee).notifications.unreadCount()).toEqual({
      count: 0,
    });
    const mail = email.sent.find((sent) => sent.to.email === owner.email);
    expect(mail).toMatchObject({
      subject: "Grace Hopper joined Analytical Engines",
      headers: {
        "List-Unsubscribe": expect.stringMatching(
          /^<http:\/\/localhost:4321\/api\/notifications\/unsubscribe\?t=[\w.%-]+>$/
        ),
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
  });

  it("markRead and archive change only the recipient's rows", async () => {
    const [item] = (
      await callerFor(owner).notifications.list({ view: "inbox", limit: 10 })
    ).items;
    const ids = [item?.id ?? ""];
    expect(await callerFor(invitee).notifications.markRead({ ids })).toEqual({
      updated: 0,
    });
    expect(await callerFor(invitee).notifications.archive({ ids })).toEqual({
      updated: 0,
    });
    expect(await callerFor(owner).notifications.unreadCount()).toEqual({
      count: 1,
    });

    expect(await callerFor(owner).notifications.markRead({ ids })).toEqual({
      updated: 1,
    });
    expect(await callerFor(owner).notifications.unreadCount()).toEqual({
      count: 0,
    });
    expect(
      await callerFor(owner).notifications.markRead({ all: true })
    ).toEqual({ updated: 0 });
    expect(await callerFor(owner).notifications.archive({ ids })).toEqual({
      updated: 1,
    });
    expect(
      (
        await callerFor(owner).notifications.list({
          view: "archived",
          limit: 10,
        })
      ).items.map((entry) => entry.id)
    ).toEqual(ids);
    await expect(
      callerFor(owner).notifications.markRead({
        ids,
        all: true,
      } as never)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("preferences: read, change, and security types refused", async () => {
    const caller = callerFor(invitee);
    const before = await caller.notifications.preferences.get();
    expect(before.emailCadence).toBe("instant");
    expect(before.types.find((row) => row.type === "auth.new-sign-in")).toEqual(
      expect.objectContaining({ locked: true, email: true })
    );
    expect(
      await caller.notifications.preferences.update({
        changes: [
          {
            type: "workspaces.role-changed",
            channel: "email",
            enabled: false,
          },
        ],
        emailCadence: "daily",
      })
    ).toEqual({ changed: 2 });
    const after = await caller.notifications.preferences.get();
    expect(after.emailCadence).toBe("daily");
    expect(
      after.types.find((row) => row.type === "workspaces.role-changed")
    ).toMatchObject({ email: false, inApp: true });
    await expect(
      caller.notifications.preferences.update({
        changes: [
          { type: "auth.password-changed", channel: "email", enabled: false },
        ],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("every procedure refuses anonymous callers", async () => {
    const anonymous = callerFor(null);
    for (const call of [
      () => anonymous.notifications.list({ view: "inbox", limit: 5 }),
      () => anonymous.notifications.unreadCount(),
      () => anonymous.notifications.markRead({ all: true }),
      () => anonymous.notifications.archive({ ids: ["n-1"] }),
      () => anonymous.notifications.preferences.get(),
      () => anonymous.notifications.preferences.update({ changes: [] }),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
  });

  it("the MCP tools list, mark read, archive and change preferences", async () => {
    const listed = await rpc(owner, "list_notifications", {
      view: "archived",
      limit: 5,
    });
    expect(listed.isError).toBeFalsy();
    expect(listed.content[0]?.text).toContain("Grace Hopper joined");
    expect(listed.content[0]?.text).toContain('"unread":0');

    const marked = await rpc(owner, "mark_notifications_read", { all: true });
    expect(marked.content[0]?.text).toContain('"updated":0');
    const archived = await rpc(owner, "archive_notifications", {
      ids: ["not-mine"],
    });
    expect(archived.content[0]?.text).toContain('"updated":0');

    const prefs = await rpc(owner, "get_notification_preferences");
    expect(prefs.content[0]?.text).toContain("workspaces.member-joined");
    const updated = await rpc(owner, "update_notification_preferences", {
      changes: [
        { type: "workspaces.member-joined", channel: "inApp", enabled: false },
      ],
    });
    expect(updated.content[0]?.text).toContain('"changed":1');
  });
});

/** The Astro context of the unsubscribe route, from one client IP. */
function routeContext(request: Request) {
  return {
    request,
    url: new URL(request.url),
    params: {},
    locals: {
      user: null,
      requestContext: { ...testRequestContext(), ip: "192.0.2.80" },
    },
  } as unknown as APIContext;
}

async function tokenFor(userId: string, type: string) {
  const secret = buildRequiredConfig(env).BETTER_AUTH_SECRET;
  return signUnsubscribeToken(await deriveUnsubscribeKey(secret), {
    userId,
    type,
  });
}

async function emailOverride(userId: string, type: string) {
  return (workerEnv as AppEnv).DB.prepare(
    "SELECT enabled FROM notification_preferences WHERE user_id = ? AND type = ? AND channel = 'email'"
  )
    .bind(userId, type)
    .first<{ enabled: number }>();
}

const ONE_CLICK = "List-Unsubscribe=One-Click";

function post(token: string, body = ONE_CLICK, origin?: string) {
  return unsubscribePost(
    routeContext(
      new Request(
        `${APP_URL}/api/notifications/unsubscribe?t=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            ...(origin ? { origin } : {}),
          },
          body,
        }
      )
    )
  );
}

describe("POST /api/notifications/unsubscribe (RFC 8058)", () => {
  it("unsubscribes on the one-click body, from any origin, without a session", async () => {
    const token = await tokenFor(owner.id, "workspaces.member-joined");
    const response = await post(token, ONE_CLICK, "https://mail.example.net");
    expect(response.status).toBe(200);
    expect(response.headers.get("ratelimit-policy")).toContain(
      "notifications.unsubscribe"
    );
    expect(await response.json()).toEqual({
      unsubscribed: true,
      types: ["workspaces.member-joined"],
    });
    expect(await emailOverride(owner.id, "workspaces.member-joined")).toEqual({
      enabled: 0,
    });
    const audit = await getDb(env).query.auditEvents.findFirst({
      where: (events, { and, eq }) =>
        and(
          eq(events.action, "notifications.unsubscribed"),
          eq(events.targetId, owner.id)
        ),
    });
    expect(audit).toMatchObject({ actorUserId: owner.id });
  });

  it("refuses a body other than RFC 8058's, a tampered and a missing token", async () => {
    const token = await tokenFor(invitee.id, "workspaces.member-joined");
    const wrongBody = await post(token, "unsubscribe=yes");
    expect(wrongBody.status).toBe(400);
    expect(wrongBody.headers.get("content-type")).toBe(
      "application/problem+json"
    );
    const tampered = await post(`${token.slice(0, -3)}xyz`);
    expect(tampered.status).toBe(400);
    expect(await tampered.json()).toMatchObject({
      code: "INVALID_UNSUBSCRIBE_TOKEN",
    });
    expect((await post("")).status).toBe(400);
    expect(
      await emailOverride(invitee.id, "workspaces.member-joined")
    ).toBeNull();
  });

  it("GET only redirects to the confirmation page and changes nothing", async () => {
    const token = await tokenFor(invitee.id, "workspaces.role-changed");
    const response = await unsubscribeGet(
      routeContext(
        new Request(
          `${APP_URL}/api/notifications/unsubscribe?t=${encodeURIComponent(token)}`
        )
      )
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `/unsubscribe?t=${encodeURIComponent(token)}`
    );
    // The invitee's role-changed email override was set by the preferences test above
    // (false); a GET of the owner's would not create one.
    const ownerToken = await tokenFor(owner.id, "workspaces.role-changed");
    await unsubscribeGet(
      routeContext(
        new Request(
          `${APP_URL}/api/notifications/unsubscribe?t=${encodeURIComponent(ownerToken)}`
        )
      )
    );
    expect(await emailOverride(owner.id, "workspaces.role-changed")).toBeNull();
  });
});

/**
 * The security notices sent from the Better Auth hooks (server/auth-audit.ts), through the
 * real handler and the real APP_QUEUE consumer of the test Worker: rows appear once the
 * queued dispatch has run.
 */
describe("security notifications from Better Auth", () => {
  const FIREFOX = "Mozilla/5.0 (Macintosh) Firefox/140.0";
  const PASSWORD = "test-password-1234";

  function authPost(path: string, body: unknown, cookie?: string) {
    const request = new Request(`${APP_URL}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: APP_URL,
        "user-agent": FIREFOX,
        ...humanHeaders("203.0.113.90"),
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });
    return withRequestContext(request, env, () =>
      getAuth(env).handler(request)
    );
  }

  async function typesFor(userId: string) {
    const { results } = await (workerEnv as AppEnv).DB.prepare(
      "SELECT type FROM notifications WHERE user_id = ? ORDER BY created_at, type"
    )
      .bind(userId)
      .all<{ type: string }>();
    return results.map((row) => row.type);
  }

  it("notifies a new sign-in and password changes, but not sign-up or a repeat sign-in", async () => {
    const signUp = await authPost("/sign-up/email", {
      name: "Barbara Liskov",
      email: "barbara@notifications.test",
      password: PASSWORD,
    });
    expect(signUp.status).toBe(200);
    const { user } = (await signUp.json()) as { user: { id: string } };
    // Out of the account's first minute: sign-ins from here on are not its sign-up.
    await (workerEnv as AppEnv).DB.prepare(
      "UPDATE user SET created_at = ? WHERE id = ?"
    )
      .bind(Date.now() - 3_600_000, user.id)
      .run();

    // The sign-up's own session is from the same browser: expire it, so the next
    // sign-in is the first live one there.
    await (workerEnv as AppEnv).DB.prepare(
      "UPDATE session SET expires_at = ? WHERE user_id = ?"
    )
      .bind(Date.now() - 1000, user.id)
      .run();
    const first = await authPost("/sign-in/email", {
      email: "barbara@notifications.test",
      password: PASSWORD,
    });
    expect(first.status).toBe(200);
    const cookie = (first.headers.get("set-cookie") ?? "").split(";")[0];
    await vi.waitFor(
      async () => expect(await typesFor(user.id)).toEqual(["auth.new-sign-in"]),
      { timeout: 20_000, interval: 250 }
    );

    // The same browser again, with a live session: not new.
    const again = await authPost("/sign-in/email", {
      email: "barbara@notifications.test",
      password: PASSWORD,
    });
    expect(again.status).toBe(200);

    const changed = await authPost(
      "/change-password",
      { currentPassword: PASSWORD, newPassword: "changed-password-5678" },
      cookie
    );
    expect(changed.status).toBe(200);
    await vi.waitFor(
      async () =>
        expect(await typesFor(user.id)).toEqual([
          "auth.new-sign-in",
          "auth.password-changed",
        ]),
      { timeout: 20_000, interval: 250 }
    );

    // A completed reset through the emailed link: another password-changed notice.
    await authPost("/request-password-reset", {
      email: "barbara@notifications.test",
      redirectTo: "/reset-password",
    });
    const row = await (workerEnv as AppEnv).DB.prepare(
      "SELECT identifier FROM verification WHERE identifier LIKE 'reset-password:%' ORDER BY created_at DESC LIMIT 1"
    ).first<{ identifier: string }>();
    const reset = await authPost("/reset-password", {
      token: row?.identifier.slice("reset-password:".length),
      newPassword: "reset-password-5678",
    });
    expect(reset.status).toBe(200);
    await vi.waitFor(
      async () =>
        expect(
          (await typesFor(user.id)).filter(
            (type) => type === "auth.password-changed"
          )
        ).toHaveLength(2),
      { timeout: 20_000, interval: 250 }
    );
    // Never a sign-in notice for the sign-up or the repeat.
    expect(
      (await typesFor(user.id)).filter((type) => type === "auth.new-sign-in")
    ).toHaveLength(1);
  }, 60_000);
});
