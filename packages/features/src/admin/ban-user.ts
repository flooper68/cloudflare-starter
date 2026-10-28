import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import {
  type AdminActor,
  banExpiry,
  requireAnotherAdminRemains,
  requireNotSelf,
} from "./domain";
import { countActiveAdmins, findTargetUser } from "./lookups";
import type { AdminAuthGateway } from "./ports";

/**
 * Suspends a user: refused at sign-in until `expiresAt` (or for good), and signed out of
 * every session now, so the suspension takes effect despite cookie-cached sessions. Not
 * on yourself, and never the last active admin.
 */
export async function banUser(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly gateway: AdminAuthGateway;
  },
  admin: AdminActor,
  input: {
    readonly userId: string;
    readonly reason?: string | null;
    readonly expiresAt?: Date | null;
  }
): Promise<{ readonly userId: string; readonly expiresAt: Date | null }> {
  const now = deps.clock.now();
  requireNotSelf(admin.userId, input.userId, "suspend");
  const target = await findTargetUser(deps.db, input.userId);
  const expiresAt = banExpiry(now, input.expiresAt ?? null);
  requireAnotherAdminRemains(
    target,
    await countActiveAdmins(deps.db, now),
    now
  );

  const reason = input.reason?.trim() || null;
  await deps.gateway.ban(target.id, { reason, expiresAt });
  const sessionCount = await deps.gateway.revokeSessions(target.id);

  await recordAuditEvent(deps, deps.requestContext, {
    action: "user.banned",
    actor: { kind: "admin", userId: admin.userId },
    target: { type: "user", id: target.id },
    metadata: {
      ...(reason ? { reason: reason.slice(0, 200) } : {}),
      ...(expiresAt ? { expiresAt: expiresAt.toISOString() } : {}),
    },
  });
  await recordAuditEvent(deps, deps.requestContext, {
    action: "user.sessions_revoked",
    actor: { kind: "admin", userId: admin.userId },
    target: { type: "user", id: target.id },
    metadata: { sessionCount },
  });
  return { userId: target.id, expiresAt };
}
