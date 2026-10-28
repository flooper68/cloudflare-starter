import { env } from "cloudflare:workers";

import {
  type Actor,
  type BillingMode,
  createBillingGate,
  createDatabase,
  createInvitation,
  createMemoryProductAnalytics,
  type Database,
  type RequestContext,
  type Role,
  type WorkspaceSettings,
} from "../src";

/** The real Drizzle client over the test D1. */
export function testDb(): Database {
  return createDatabase(env.DB);
}

/** A clock frozen at a known time. */
export function fixedClock(iso = "2026-10-28T12:00:00.000Z") {
  return { now: () => new Date(iso) };
}

/** Ids that count up, so tests can predict them. */
export function sequentialIds(prefix = "00000000-0000-4000-8000-") {
  let next = 0;
  return { uuid: () => `${prefix}${String(++next).padStart(12, "0")}` };
}

/** Inserts a user (Better Auth's table) and returns it. */
export async function seedUser(
  name = "Nicole Example",
  email = `${name.toLowerCase().replace(/\s+/g, ".")}@example.test`
) {
  const id = `user-${email}`;
  await env.DB.prepare(
    "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)"
  )
    .bind(id, name, email, Date.now(), Date.now())
    .run();
  return { id, name, email };
}

/** A request context as the HTTP edge builds it, for use cases that record their origin. */
export function testRequestContext(
  overrides: Partial<RequestContext> = {}
): RequestContext {
  return {
    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    spanId: "00f067aa0ba902b7",
    parentSpanId: null,
    traceFlags: "01",
    source: "http",
    userId: null,
    workspaceId: null,
    ip: "203.0.113.7",
    release: "local",
    environment: "local",
    ...overrides,
  };
}

/** Inserts a workspace with `ownerId` as its owner and returns the owner's actor. */
export async function seedWorkspace(
  ownerId: string,
  options: {
    readonly id?: string;
    readonly name?: string;
    readonly kind?: "personal" | "shared";
  } = {}
): Promise<Actor> {
  const id = options.id ?? `ws-${ownerId}-${options.name ?? "acme"}`;
  await env.DB.prepare(
    "INSERT INTO workspaces (id, name, kind, created_by) VALUES (?, ?, ?, ?)"
  )
    .bind(
      id,
      options.name ?? "Acme Robotics",
      options.kind ?? "shared",
      ownerId
    )
    .run();
  return addMember(id, ownerId, "owner");
}

/** Adds `userId` to a workspace with `role` and returns their actor there. */
export async function addMember(
  workspaceId: string,
  userId: string,
  role: Role = "member"
): Promise<Actor> {
  await env.DB.prepare(
    "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)"
  )
    .bind(workspaceId, userId, role)
    .run();
  return { userId, workspaceId, role };
}

/** Workspace settings for a use case, multi mode with open sign-up unless overridden. */
export function settings(
  overrides: Partial<WorkspaceSettings> = {}
): WorkspaceSettings {
  return {
    mode: "multi",
    signUp: "open",
    signUpDomains: [],
    bootstrapAdminEmail: null,
    ...overrides,
  };
}

/** Rows of a query, for assertions on what was written. */
export async function rows(query: string, ...params: unknown[]) {
  const { results } = await env.DB.prepare(query)
    .bind(...params)
    .all();
  return results;
}

/** Invites `email` into the actor's workspace through the real use case; returns the token. */
export async function invite(
  actor: Actor,
  email: string,
  role: Role = "member",
  options: { readonly at?: string; readonly ids?: string } = {}
) {
  const created = await createInvitation(
    {
      db: testDb(),
      clock: fixedClock(options.at),
      ids: sequentialIds(
        options.ids ??
          `${Math.random().toString(16).slice(2, 10).padEnd(8, "0")}-0000-4000-8000-`
      ),
      email: null,
      requestContext: testRequestContext(),
      billing: testBilling(),
    },
    actor,
    { mode: "multi", email, role, appUrl: "http://localhost:4321" }
  );
  return { ...created, token: created.link.split("/invite/")[1] as string };
}

/**
 * The BillingGate for a use case: BILLING=off (unlimited, nothing recorded) unless a test
 * of billing asks for another mode.
 */
export function testBilling(mode: BillingMode = "off", at?: string) {
  return createBillingGate({
    db: testDb(),
    clock: fixedClock(at),
    ids: sequentialIds(
      `${Math.random().toString(16).slice(2, 10).padEnd(8, "0")}-2222-4000-8000-`
    ),
    requestContext: testRequestContext(),
    settings: { mode },
  });
}

let depsRun = 0;

/**
 * Dependencies of a workspace use case: real D1, fixed clock, fresh ids, a request
 * context, and a memory ProductAnalytics whose `recorded` calls tests can assert on.
 */
export function useCaseDeps(at?: string) {
  depsRun += 1;
  return {
    db: testDb(),
    clock: fixedClock(at),
    ids: sequentialIds(`${String(depsRun).padStart(8, "0")}-1111-4000-8000-`),
    requestContext: testRequestContext(),
    analytics: createMemoryProductAnalytics(),
    billing: testBilling("off", at),
  };
}

/** Dependencies of a billing use case: useCaseDeps plus the BILLING mode (manual unless stated). */
export function billingDeps(mode: BillingMode = "manual", at?: string) {
  return { ...useCaseDeps(at), settings: { mode } };
}

/** Audit events recorded for a workspace, oldest first: action, target and metadata. */
export async function auditTrail(workspaceId: string) {
  const { results } = await env.DB.prepare(
    "SELECT action, actor_user_id AS actor, target_type || ':' || target_id AS target, metadata FROM audit_events WHERE workspace_id = ? ORDER BY occurred_at, rowid"
  )
    .bind(workspaceId)
    .all<{
      action: string;
      actor: string | null;
      target: string;
      metadata: string;
    }>();
  return results.map((row) => ({ ...row, metadata: JSON.parse(row.metadata) }));
}
