import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  fixedClock,
  sequentialIds,
  testDb,
  testRequestContext,
} from "../../test/fixtures";
import { InvalidAuditInputError } from "./domain";
import { recordAuditEvent } from "./record-audit-event";

const deps = () => ({
  db: testDb(),
  clock: fixedClock(),
  ids: sequentialIds(),
});

async function storedRows() {
  const { results } = await env.DB.prepare(
    "SELECT * FROM audit_events ORDER BY id"
  ).all();
  return results;
}

describe("recordAuditEvent", () => {
  it("stores the event with its origin from the request context", async () => {
    const context = testRequestContext({
      userId: "user-ada",
      workspaceId: "ws-1",
    });
    const event = await recordAuditEvent(deps(), context, {
      action: "auth.sign_in",
      target: { type: "user", id: "user-ada" },
      metadata: { method: "password" },
    });

    expect(event).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      occurredAt: "2026-10-28T12:00:00.000Z",
      action: "auth.sign_in",
      outcome: "success",
      actor: { kind: "user", userId: "user-ada", impersonatorUserId: null },
      target: { type: "user", id: "user-ada" },
      workspaceId: "ws-1",
      traceId: context.traceId,
      source: "http",
      ip: "203.0.113.7",
      metadata: { method: "password" },
    });
    expect(await storedRows()).toContainEqual({
      id: event.id,
      occurred_at: Date.parse("2026-10-28T12:00:00.000Z"),
      action: "auth.sign_in",
      outcome: "success",
      actor_user_id: "user-ada",
      actor_kind: "user",
      impersonator_user_id: null,
      target_type: "user",
      target_id: "user-ada",
      workspace_id: "ws-1",
      trace_id: context.traceId,
      source: "http",
      ip: "203.0.113.7",
      metadata: '{"method":"password"}',
    });
  });

  it("records the system as the actor when the context has no user", async () => {
    const event = await recordAuditEvent(
      { ...deps(), ids: sequentialIds("10000000-0000-4000-8000-") },
      testRequestContext({ source: "cron", ip: null }),
      { action: "user.deleted", target: { type: "user", id: "user-gone" } }
    );
    expect(event).toMatchObject({
      actor: { kind: "system", userId: null },
      source: "cron",
      ip: null,
      metadata: {},
    });
  });

  it("keeps an explicit actor, including an impersonating admin", async () => {
    const event = await recordAuditEvent(
      { ...deps(), ids: sequentialIds("20000000-0000-4000-8000-") },
      testRequestContext({ userId: "user-ada" }),
      {
        action: "user.sessions_revoked",
        actor: {
          kind: "admin",
          userId: "user-ada",
          impersonatorUserId: "user-grace",
        },
        target: { type: "user", id: "user-ada" },
        metadata: { sessionCount: 2 },
      }
    );
    expect(event.actor).toEqual({
      kind: "admin",
      userId: "user-ada",
      impersonatorUserId: "user-grace",
    });
  });

  it("refuses metadata the catalog does not declare, and writes nothing", async () => {
    const before = (await storedRows()).length;
    await expect(
      recordAuditEvent(deps(), testRequestContext(), {
        action: "auth.sign_in_failed",
        target: { type: "email", id: "ada@example.test" },
        metadata: {
          method: "password",
          reason: "INVALID_EMAIL_OR_PASSWORD",
          // @ts-expect-error: not in the catalog, which is the point
          password: "hunter2-hunter2",
        },
      })
    ).rejects.toThrow(InvalidAuditInputError);
    expect(await storedRows()).toHaveLength(before);
  });

  it("names the impersonating admin on events of the impersonated user", async () => {
    const context = testRequestContext({
      userId: "user-mia",
      impersonatorUserId: "user-admin",
    });
    const ids = { uuid: () => "imp-00000000-0000-4000-8000-000000000001" };
    const own = await recordAuditEvent({ ...deps(), ids }, context, {
      action: "workspace.created",
      actor: { kind: "user", userId: "user-mia" },
      workspaceId: "ws-imp",
      target: { type: "workspace", id: "ws-imp" },
      metadata: { kind: "shared" },
    });
    expect(own.actor).toMatchObject({
      userId: "user-mia",
      impersonatorUserId: "user-admin",
    });
    const other = await recordAuditEvent(
      {
        ...deps(),
        ids: { uuid: () => "imp-00000000-0000-4000-8000-000000000002" },
      },
      context,
      {
        action: "user.unbanned",
        actor: { kind: "admin", userId: "user-other" },
        target: { type: "user", id: "user-x" },
      }
    );
    expect(other.actor.impersonatorUserId ?? null).toBeNull();
  });
});
