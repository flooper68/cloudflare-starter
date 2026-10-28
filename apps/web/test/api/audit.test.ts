// The audit log from the outside: Better Auth's sign-up, sign-in, failed sign-in and
// password reset write audit events carrying the request's trace id (the x-request-id the
// user sees), and the daily cron purges events past retention.
import { env } from "cloudflare:workers";
import {
  type AuditEvent,
  type AuditQueryInput,
  listAuditEvents,
  recordAuditEvent,
} from "@cloudflare-starter/features";
import { describe, expect, it } from "vitest";

import { getAuth } from "@/server/auth";
import { AUDIT_PURGE_CRON, runScheduled } from "@/server/cron";
import { getDb } from "@/server/db";
import { REQUEST_ID_HEADER, withRequestContext } from "@/server/http";
import { buildPlatform } from "@/server/platform";

import { APP_URL, testRequestContext } from "./helpers";

const CLIENT_IP = "203.0.113.7";

/** A Better Auth request through the HTTP edge, as middleware.ts and the auth route run it. */
function authPost(
  path: string,
  body: unknown,
  cookie?: string
): Promise<Response> {
  const request = new Request(`${APP_URL}/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: APP_URL,
      "cf-connecting-ip": CLIENT_IP,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  return withRequestContext(request, env, () => getAuth(env).handler(request));
}

async function events(
  filters: AuditQueryInput
): Promise<readonly AuditEvent[]> {
  return (await listAuditEvents({ db: getDb(env) }, filters)).events;
}

const PASSWORD = "test-password-1234";
const NEW_PASSWORD = "changed-password-5678";

describe("audit log of Better Auth endpoints", () => {
  it("sign-up records auth.sign_up and the session it opens as auth.sign_in", async () => {
    const response = await authPost("/sign-up/email", {
      name: "Grace Hopper",
      email: "grace@example.test",
      password: PASSWORD,
    });
    expect(response.status).toBe(200);
    const traceId = response.headers.get(REQUEST_ID_HEADER);
    const { user } = (await response.json()) as { user: { id: string } };

    expect(await events({ actorUserId: user.id })).toEqual([
      expect.objectContaining({
        action: "auth.sign_in",
        metadata: { method: "sign_up" },
        traceId,
      }),
      expect.objectContaining({
        action: "auth.sign_up",
        outcome: "success",
        actor: { kind: "user", userId: user.id, impersonatorUserId: null },
        target: { type: "user", id: user.id },
        metadata: { method: "password" },
        traceId,
        source: "http",
        ip: CLIENT_IP,
      }),
      // The personal workspace the sign-up provisions (multi mode in the API tests).
      expect.objectContaining({
        action: "workspace.created",
        metadata: { kind: "personal" },
        traceId,
      }),
    ]);
  });

  it("sign-in records auth.sign_in with the trace id of the response", async () => {
    const response = await authPost("/sign-in/email", {
      email: "grace@example.test",
      password: PASSWORD,
    });
    expect(response.status).toBe(200);
    const traceId = response.headers.get(REQUEST_ID_HEADER);
    expect(traceId).toMatch(/^[0-9a-f]{32}$/);

    const [event] = await events({ action: "auth.sign_in", limit: 1 });
    expect(event).toMatchObject({
      outcome: "success",
      actor: { kind: "user" },
      target: { type: "user" },
      metadata: { method: "password" },
      traceId,
      source: "http",
      ip: CLIENT_IP,
    });
  });

  it("a wrong password records auth.sign_in_failed without the password", async () => {
    const response = await authPost("/sign-in/email", {
      email: "Grace@Example.test",
      password: "wrong-password-0",
    });
    expect(response.status).toBe(401);

    const failed = await events({ action: "auth.sign_in_failed" });
    expect(failed).toEqual([
      expect.objectContaining({
        outcome: "failure",
        actor: { kind: "user", userId: null, impersonatorUserId: null },
        target: { type: "email", id: "grace@example.test" },
        metadata: { method: "password", reason: "INVALID_EMAIL_OR_PASSWORD" },
        traceId: response.headers.get(REQUEST_ID_HEADER),
        ip: CLIENT_IP,
      }),
    ]);
    expect(JSON.stringify(failed)).not.toContain("wrong-password-0");
  });

  it("a password reset request records auth.password_reset_requested", async () => {
    const response = await authPost("/request-password-reset", {
      email: "grace@example.test",
      redirectTo: "/reset-password",
    });
    expect(response.status).toBe(200);

    expect(await events({ action: "auth.password_reset_requested" })).toEqual([
      expect.objectContaining({
        target: { type: "email", id: "grace@example.test" },
        metadata: {},
        traceId: response.headers.get(REQUEST_ID_HEADER),
      }),
    ]);
  });

  it("a password change records auth.password_changed, not a sign-in", async () => {
    const signIn = await authPost("/sign-in/email", {
      email: "grace@example.test",
      password: PASSWORD,
    });
    const cookie = (signIn.headers.get("set-cookie") ?? "").split(";")[0];
    const { user } = (await signIn.json()) as { user: { id: string } };

    const refused = await authPost(
      "/change-password",
      { currentPassword: "not-the-password", newPassword: NEW_PASSWORD },
      cookie
    );
    expect(refused.status).toBe(400);
    const changed = await authPost(
      "/change-password",
      {
        currentPassword: PASSWORD,
        newPassword: NEW_PASSWORD,
        revokeOtherSessions: true,
      },
      cookie
    );
    expect(changed.status).toBe(200);

    const traceOf = (response: Response) =>
      response.headers.get(REQUEST_ID_HEADER);
    const recorded = await events({
      action: "auth.password_changed",
      actorUserId: user.id,
    });
    expect(recorded).toEqual([
      expect.objectContaining({
        outcome: "success",
        target: { type: "user", id: user.id },
        metadata: { method: "change" },
        traceId: traceOf(changed),
      }),
      expect.objectContaining({
        outcome: "failure",
        metadata: { method: "change", reason: "INVALID_PASSWORD" },
        traceId: traceOf(refused),
      }),
    ]);
    // The session the change re-issues is not a sign-in.
    const signIns = await events({ action: "auth.sign_in" });
    expect(signIns.map((event) => event.traceId)).not.toContain(
      traceOf(changed)
    );
  });

  it("a completed password reset records auth.password_changed", async () => {
    await authPost("/request-password-reset", {
      email: "grace@example.test",
      redirectTo: "/reset-password",
    });
    const row = await env.DB.prepare(
      "SELECT identifier FROM verification WHERE identifier LIKE 'reset-password:%' ORDER BY created_at DESC LIMIT 1"
    ).first<{ identifier: string }>();
    const token = row?.identifier.slice("reset-password:".length);

    const response = await authPost("/reset-password", {
      token,
      newPassword: "reset-password-5678",
    });
    expect(response.status).toBe(200);

    const [event] = await events({
      action: "auth.password_changed",
      limit: 1,
    });
    expect(event).toMatchObject({
      outcome: "success",
      actor: { kind: "user" },
      target: { type: "user" },
      metadata: { method: "reset" },
      traceId: response.headers.get(REQUEST_ID_HEADER),
    });
    expect(JSON.stringify(event)).not.toContain(token);
  });
});

describe("audit purge cron", () => {
  it("deletes events past retention on the daily schedule", async () => {
    const db = getDb(env);
    const ids = { uuid: () => crypto.randomUUID() };
    const recordAt = (at: string) =>
      recordAuditEvent(
        { db, clock: { now: () => new Date(at) }, ids },
        testRequestContext(),
        { action: "user.deleted", target: { type: "user", id: `user-${at}` } }
      );
    const old = await recordAt("2020-01-01T00:00:00.000Z");
    const recent = await recordAt("2026-10-01T00:00:00.000Z");

    await runScheduled(
      {
        cron: AUDIT_PURGE_CRON,
        scheduledTime: Date.parse("2026-10-28T03:17:00.000Z"),
      } as ScheduledController,
      buildPlatform(env),
      { db }
    );

    const left = (await events({ action: "user.deleted" })).map(
      (event) => event.id
    );
    expect(left).toContain(recent.id);
    expect(left).not.toContain(old.id);
  });
});
