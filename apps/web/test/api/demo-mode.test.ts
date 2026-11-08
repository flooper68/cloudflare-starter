// Demo mode (DEMO_MODE=on) through the real Worker pieces: the queue consumer with the real
// job catalog, Better Auth's user deletion and its hooks, the admin procedures and the SPA
// bootstrap. The retention rules themselves are covered by the demo feature's tests.
import { createMessageBatch } from "cloudflare:test";
import { env as workerEnv } from "cloudflare:workers";
import type { JobEnvelope } from "@cloudflare-starter/features";
import { beforeAll, describe, expect, it } from "vitest";

import type { AppEnv } from "@/server/env";
import { buildPlatform } from "@/server/platform";
import { handleQueueBatch, queueDeps } from "@/server/queue";
import { spaBootstrap } from "@/server/spa-bootstrap";
import { callerFor, signUp, type TestUser } from "./helpers";

const env = workerEnv as AppEnv;
const demoEnv = {
  ...env,
  DEMO_MODE: "on",
  DEMO_RETENTION_DAYS: "7",
  DEMO_SAMPLE_DATA: "on",
  DEMO_PROTECTED_EMAILS: "keep@demo.test",
} as AppEnv;
const DAY = 24 * 60 * 60 * 1000;

let admin: TestUser;
beforeAll(async () => {
  admin = await signUp("Demo admin", "demo-admin@demo.test", demoEnv);
  await sql("UPDATE user SET role = 'admin' WHERE id = ?", admin.id);
});

function sql(query: string, ...params: unknown[]) {
  return env.DB.prepare(query)
    .bind(...params)
    .run();
}
async function all(query: string, ...params: unknown[]) {
  return (
    await env.DB.prepare(query)
      .bind(...params)
      .all()
  ).results;
}

let n = 0;
async function consume(type: string, data: unknown, runtimeEnv = demoEnv) {
  n += 1;
  const body: JobEnvelope = {
    specversion: "1.0",
    id: `7a1c2d3e-0000-4000-8000-${String(n).padStart(12, "0")}`,
    source: "/develop/cron",
    type,
    time: new Date().toISOString(),
    datacontenttype: "application/json",
    data,
  };
  const batch = createMessageBatch("cloudflare-starter-develop", [
    { id: `msg-${n}`, body, attempts: 1, timestamp: Date.now() },
  ]);
  await handleQueueBatch(
    batch,
    buildPlatform(runtimeEnv),
    queueDeps(runtimeEnv)
  );
}

/** Signs a user up in demo mode and backdates the account by `days`. */
async function demoAccount(email: string, days: number) {
  const user = await signUp(email.split("@")[0] ?? email, email, demoEnv);
  await sql(
    "UPDATE user SET created_at = ? WHERE id = ?",
    Date.now() - days * DAY,
    user.id
  );
  return user;
}

async function exists(userId: string) {
  return (await all("SELECT id FROM user WHERE id = ?", userId)).length === 1;
}

describe("demo mode in the Worker", () => {
  it("seeds a new personal workspace through the consumer, once", async () => {
    const visitor = await signUp("Seed visitor", "seed@demo.test", demoEnv);
    const [membership] = await all(
      "SELECT workspace_id FROM workspace_members WHERE user_id = ?",
      visitor.id
    );
    const workspaceId = membership?.workspace_id as string;
    const payload = { userId: visitor.id, workspaceId };
    await consume("demo.seed-workspace", payload);
    await consume("demo.seed-workspace", payload);
    const notes = await all(
      "SELECT title FROM notes WHERE workspace_id = ? ORDER BY title",
      workspaceId
    );
    expect(notes.map((note) => note.title)).toEqual([
      "Sample: Launch checklist",
      "Sample: Product sync notes",
      "Sample: Welcome to the demo",
    ]);
    expect(
      await all(
        "SELECT id FROM note_comments WHERE workspace_id = ?",
        workspaceId
      )
    ).toHaveLength(1);
  });

  it("warns, then erases through Better Auth's delete and the privacy erasure, sparing exempt accounts", async () => {
    const visitor = await demoAccount("expired@demo.test", 10);
    const kept = [
      await demoAccount("keep@demo.test", 30),
      await demoAccount("qa+run-1@qa.flooper.me", 30),
    ];
    const first = new Date(Date.now() - DAY - 60_000).toISOString();

    // Day one: only the warning (an expired account is never erased unwarned).
    await consume("demo.enforce-retention", { asOf: first, batch: 0 });
    expect(await exists(visitor.id)).toBe(true);
    await consume("demo.warn-account", { userId: visitor.id, asOf: first });
    await sql(
      "UPDATE audit_events SET occurred_at = ? WHERE action = 'demo.deletion_warned' AND target_id = ?",
      Date.parse(first),
      visitor.id
    );
    expect(
      await all(
        "SELECT action FROM audit_events WHERE action = 'demo.deletion_warned' AND target_id IN (?, ?)",
        kept[0]?.id,
        kept[1]?.id
      )
    ).toEqual([]);

    // Day two: erased, with the hooks' completion; the exempt accounts stay.
    await consume("demo.enforce-retention", {
      asOf: new Date().toISOString(),
      batch: 0,
    });
    expect(await exists(visitor.id)).toBe(false);
    for (const user of kept) expect(await exists(user.id)).toBe(true);
    expect(await exists(admin.id)).toBe(true);
    expect(
      (
        await all(
          "SELECT action FROM audit_events WHERE target_type = 'user' AND target_id = ? AND action IN ('demo.deletion_warned', 'demo.account_erased', 'privacy.user_erased') ORDER BY occurred_at",
          visitor.id
        )
      ).map((row) => row.action)
    ).toEqual([
      "demo.deletion_warned",
      "privacy.user_erased",
      "demo.account_erased",
    ]);
    expect(
      await all(
        "SELECT completed_at IS NOT NULL AS done FROM erasure_records WHERE user_id = ?",
        visitor.id
      )
    ).toEqual([{ done: 1 }]);
    expect(await all("SELECT id FROM privacy_erasure_lock")).toEqual([]);
  });

  it("does nothing with DEMO_MODE=off", async () => {
    const visitor = await demoAccount("off@demo.test", 30);
    await sql(
      "INSERT INTO audit_events (id, occurred_at, action, outcome, actor_kind, target_type, target_id, trace_id, source, metadata) VALUES (?, ?, 'demo.deletion_warned', 'success', 'system', 'user', ?, 'trace', 'queue', '{}')",
      crypto.randomUUID(),
      Date.now() - 2 * DAY,
      visitor.id
    );
    await consume(
      "demo.enforce-retention",
      { asOf: new Date().toISOString(), batch: 0 },
      env
    );
    expect(await exists(visitor.id)).toBe(true);
    await sql("DELETE FROM user WHERE id = ?", visitor.id);
  });

  it("shows the demo counters and settings to admins, and nothing with off", async () => {
    const overview = await callerFor(admin, demoEnv).admin.overview.get();
    expect(overview.demo).toEqual({
      retentionDays: 7,
      activeAccounts: expect.any(Number),
      scheduledToday: expect.any(Number),
      erasedLast7Days: expect.any(Number),
    });
    expect(overview.demo?.erasedLast7Days).toBeGreaterThanOrEqual(1);
    expect((await callerFor(admin, env).admin.overview.get()).demo).toBeNull();
    expect((await callerFor(admin, demoEnv).admin.settings.get()).demo).toEqual(
      {
        mode: "on",
        retentionDays: 7,
        sampleData: true,
        protectedEmails: ["keep@demo.test"],
        qaEmailDomain: "qa.flooper.me",
      }
    );
    expect((await callerFor(admin, env).admin.settings.get()).demo).toEqual({
      mode: "off",
    });
  });

  it("tells the app shell the retention for the banner", async () => {
    const locals = {
      user: { id: admin.id, name: admin.name, email: admin.email, image: null },
      session: { impersonatedBy: null },
    } as unknown as Parameters<typeof spaBootstrap>[1];
    expect((await spaBootstrap(demoEnv, locals)).demo).toEqual({
      retentionDays: 7,
    });
    expect((await spaBootstrap(env, locals)).demo).toBeNull();
  });
});
