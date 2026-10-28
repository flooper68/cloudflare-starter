import { env } from "cloudflare:workers";

import { useCaseDeps } from "./fixtures";
import { memoryAdminAuthGateway } from "./memory-admin-auth-gateway";

/** The time admin tests run at (fixedClock's default). */
export const NOW = new Date("2026-10-28T12:00:00.000Z");
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/** Inserts a user with a platform role and suspension state; returns its id. */
export async function seedAccount(
  name: string,
  options: {
    readonly role?: string | null;
    readonly banned?: boolean;
    readonly banExpires?: Date | null;
    readonly verified?: boolean;
    readonly createdAt?: Date;
    readonly email?: string;
  } = {}
) {
  const email =
    options.email ?? `${name.toLowerCase().replace(/\s+/g, ".")}@example.test`;
  const id = `user-${email}`;
  const created = (
    options.createdAt ?? new Date(NOW.getTime() - DAY)
  ).getTime();
  await env.DB.prepare(
    "INSERT INTO user (id, name, email, email_verified, role, banned, ban_expires, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      id,
      name,
      email,
      options.verified ? 1 : 0,
      options.role === undefined ? "user" : options.role,
      options.banned ? 1 : 0,
      options.banExpires?.getTime() ?? null,
      created,
      created
    )
    .run();
  return { id, name, email };
}

let sessions = 0;

/** Inserts a session of the user (a sign-in `minutesAgo` minutes before NOW). */
export async function seedSession(
  userId: string,
  options: {
    readonly minutesAgo?: number;
    readonly impersonatedBy?: string;
    readonly expired?: boolean;
  } = {}
) {
  sessions += 1;
  const created = NOW.getTime() - (options.minutesAgo ?? 5) * MINUTE;
  const expires = options.expired
    ? NOW.getTime() - MINUTE
    : NOW.getTime() + 7 * DAY;
  const id = `session-${sessions}`;
  await env.DB.prepare(
    "INSERT INTO session (id, token, user_id, created_at, updated_at, expires_at, ip_address, user_agent, impersonated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      id,
      `token-${sessions}`,
      userId,
      created,
      created,
      expires,
      "203.0.113.9",
      "Mozilla/5.0 (Macintosh)",
      options.impersonatedBy ?? null
    )
    .run();
  return id;
}

/** Use case deps at NOW with a recording gateway. */
export function adminDeps(
  options: Parameters<typeof memoryAdminAuthGateway>[0] = {}
) {
  return {
    ...useCaseDeps(NOW.toISOString()),
    gateway: memoryAdminAuthGateway(options),
  };
}

/** Audit events about a user (as target), oldest first. */
export async function userAudit(userId: string) {
  const { results } = await env.DB.prepare(
    "SELECT action, actor_kind AS actorKind, actor_user_id AS actor, metadata FROM audit_events WHERE target_type = 'user' AND target_id = ? ORDER BY occurred_at, rowid"
  )
    .bind(userId)
    .all<{
      action: string;
      actorKind: string;
      actor: string | null;
      metadata: string;
    }>();
  return results.map((row) => ({ ...row, metadata: JSON.parse(row.metadata) }));
}
