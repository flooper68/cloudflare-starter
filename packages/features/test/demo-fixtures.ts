import { env } from "cloudflare:workers";

import { recordAuditEvent } from "../src/audit";
import type { DemoRetentionPolicy, DemoRuntime } from "../src/demo";
import { buildErasureHandlers } from "../src/erasure-catalog";
import {
  createMemoryEmail,
  createMemoryErrorReporter,
  createMemoryLogger,
} from "../src/platform";
import { completeUserErasure } from "../src/privacy";
import {
  fixedClock,
  sequentialIds,
  testDb,
  testRequestContext,
  useCaseDeps,
} from "./fixtures";

/** The demo tests' "now": a daily run at 03:17 UTC. */
export const DEMO_NOW = "2026-11-08T03:17:00.000Z";
export const DAY = 24 * 60 * 60 * 1000;

export function daysBefore(days: number, iso = DEMO_NOW): Date {
  return new Date(Date.parse(iso) - days * DAY);
}

export const demoPolicy: DemoRetentionPolicy = {
  retentionDays: 7,
  protectedEmails: ["owner@flooper.test"],
  bootstrapAdminEmail: "founder@flooper.test",
  qaEmailDomain: "qa.flooper.test",
};

export function demoOn(
  overrides: Partial<Extract<DemoRuntime, { mode: "on" }>> = {}
): DemoRuntime {
  return {
    mode: "on",
    sampleData: true,
    workspaceMode: "multi",
    policy: demoPolicy,
    ...overrides,
  };
}

/** Inserts a user created at `createdAt` (Better Auth's table), with its personal workspace. */
export async function seedDemoUser(
  email: string,
  createdAt: Date,
  options: { readonly role?: string | null; readonly workspace?: boolean } = {}
) {
  const id = `user-${email}`;
  await env.DB.prepare(
    "INSERT INTO user (id, name, email, email_verified, created_at, updated_at, role) VALUES (?, ?, ?, 1, ?, ?, ?)"
  )
    .bind(
      id,
      email.split("@")[0],
      email,
      createdAt.getTime(),
      createdAt.getTime(),
      options.role === undefined ? "user" : options.role
    )
    .run();
  const workspaceId = `personal-${id}`;
  if (options.workspace !== false) {
    await env.DB.prepare(
      "INSERT INTO workspaces (id, name, kind, created_by) VALUES (?, 'Personal', 'personal', ?)"
    )
      .bind(workspaceId, id)
      .run();
    await env.DB.prepare(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')"
    )
      .bind(workspaceId, id)
      .run();
  }
  return { id, email, workspaceId };
}

/** Records the retention's warning for `userId` at `at`, as the warning job does. */
export async function markWarned(userId: string, at: Date) {
  await recordAuditEvent(
    {
      db: testDb(),
      clock: { now: () => at },
      ids: sequentialIds(
        `${Math.random().toString(16).slice(2, 10).padEnd(8, "0")}-3333-4000-8000-`
      ),
    },
    testRequestContext({ source: "queue" }),
    {
      action: "demo.deletion_warned",
      actor: { kind: "system" },
      target: { type: "user", id: userId },
      metadata: { deletesAt: new Date(at.getTime() + DAY).toISOString() },
    }
  );
}

/**
 * Better Auth's user deletion as the auth hooks run it: deletes the row, then
 * `completeUserErasure` (erasure record, `privacy.user_erased`, lock released).
 */
export function testAuthUsers(at = DEMO_NOW) {
  const deleted: string[] = [];
  return {
    deleted,
    async deleteUser(userId: string, operationId?: string) {
      const row = await env.DB.prepare("SELECT email FROM user WHERE id = ?")
        .bind(userId)
        .first<{ email: string }>();
      await env.DB.prepare("DELETE FROM user WHERE id = ?").bind(userId).run();
      deleted.push(userId);
      if (!row || !operationId) return;
      await completeUserErasure(
        {
          ...useCaseDeps(at),
          email: createMemoryEmail(),
          errors: createMemoryErrorReporter(),
        },
        { userId, email: row.email, operationId }
      );
    },
  };
}

/** What the retention job gets: real D1, R2 and erasers; Better Auth's delete simulated. */
export function retentionDeps(at = DEMO_NOW, demo: DemoRuntime = demoOn()) {
  const base = useCaseDeps(at);
  const gateway = testAuthUsers(at);
  return {
    ...base,
    clock: fixedClock(at),
    requestContext: testRequestContext({ source: "queue", ip: null }),
    logger: createMemoryLogger(),
    demo,
    authUsers: gateway,
    gateway,
    ...buildErasureHandlers({
      db: base.db,
      bucket: env.FILES,
      clock: fixedClock(at),
    }),
  };
}

/**
 * Empties the tables the retention scans, so each test of a file (which share storage)
 * starts from no accounts.
 */
export async function resetDemoState() {
  await env.DB.batch(
    [
      "DELETE FROM workspaces",
      "DELETE FROM user",
      "DELETE FROM audit_events",
      "DELETE FROM privacy_erasure_lock",
      "DELETE FROM erasure_records",
    ].map((query) => env.DB.prepare(query))
  );
}

export async function userExists(id: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT id FROM user WHERE id = ?")
    .bind(id)
    .first();
  return row !== null;
}
