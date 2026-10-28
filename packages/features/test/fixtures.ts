import { env } from "cloudflare:workers";

import {
  type Actor,
  createDatabase,
  createInvitation,
  createMemoryErrorReporter,
  createMemoryJobQueue,
  type Database,
  type MemoryJobQueue,
  type Notify,
  notify,
  type RequestContext,
  type Role,
  type WorkspaceSettings,
} from "../src";

/** The app as mail sees it, for job handlers (JobDeps.app). The secret is a test value. */
export const testApp = {
  name: "Cloudflare Starter",
  url: "https://app.example.test",
  secret: "test-secret-for-unsubscribe-links-0123456789",
} as const;

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
    },
    actor,
    { mode: "multi", email, role, appUrl: "http://localhost:4321" }
  );
  return { ...created, token: created.link.split("/invite/")[1] as string };
}

let depsRun = 0;

/** Dependencies of a workspace use case: real D1, fixed clock, fresh ids, a request context. */
export function useCaseDeps(at?: string) {
  depsRun += 1;
  const clock = fixedClock(at);
  const ids = sequentialIds(
    `${String(depsRun).padStart(8, "0")}-1111-4000-8000-`
  );
  const jobQueue = createMemoryJobQueue();
  const errors = createMemoryErrorReporter();
  const bound: Notify = (definition, input) =>
    notify({ jobQueue, clock, ids, errors }, definition, input);
  return {
    db: testDb(),
    clock,
    ids,
    requestContext: testRequestContext(),
    /** Where `notify` enqueues: assert with notificationsSent(deps.jobQueue). */
    jobQueue,
    /** Notification failures notify reported instead of throwing. */
    errors,
    notify: bound,
  };
}

/** The notification events a use case sent through `useCaseDeps().notify`. */
export function notificationsSent(jobQueue: MemoryJobQueue) {
  return jobQueue.sent
    .filter((sent) => sent.envelope.type === "notifications.dispatch")
    .map((sent) => {
      const payload = sent.envelope.data as {
        event: { type: string; data: unknown; workspaceid?: string };
        recipients: string[];
      };
      return {
        type: payload.event.type,
        recipients: payload.recipients,
        data: payload.event.data,
        workspaceId: payload.event.workspaceid ?? null,
      };
    });
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

/** Inserts an inbox row for `userId`; defaults to an unread in-app member-joined notice. */
export async function seedNotification(
  userId: string,
  options: {
    readonly id: string;
    readonly type?: string;
    readonly data?: unknown;
    readonly workspaceId?: string | null;
    readonly inApp?: boolean;
    readonly emailState?: string;
    readonly eventId?: string;
    readonly createdAt?: string;
    readonly readAt?: string | null;
    readonly archivedAt?: string | null;
  }
) {
  const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : null);
  await env.DB.prepare(
    "INSERT INTO notifications (id, user_id, workspace_id, type, data, in_app, email_state, event_id, read_at, archived_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      options.id,
      userId,
      options.workspaceId ?? null,
      options.type ?? "workspaces.member-joined",
      JSON.stringify(
        options.data ?? {
          workspaceId: "ws-acme",
          workspaceName: "Acme Robotics",
          memberName: "Grace Hopper",
          role: "member",
        }
      ),
      options.inApp === false ? 0 : 1,
      options.emailState ?? "none",
      options.eventId ?? `event-${options.id}`,
      ms(options.readAt),
      ms(options.archivedAt),
      ms(options.createdAt ?? "2026-10-28T11:00:00.000Z")
    )
    .run();
}

/** Audit events recorded about a user (target user), oldest first. */
export async function userAuditTrail(userId: string) {
  const { results } = await env.DB.prepare(
    "SELECT action, actor_user_id AS actor, metadata FROM audit_events WHERE target_type = 'user' AND target_id = ? ORDER BY occurred_at, rowid"
  )
    .bind(userId)
    .all<{ action: string; actor: string | null; metadata: string }>();
  return results.map((row) => ({ ...row, metadata: JSON.parse(row.metadata) }));
}
