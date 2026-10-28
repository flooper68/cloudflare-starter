import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { type AdminActor, requireNotSelf } from "./domain";
import { findTargetUser } from "./lookups";
import type { AdminAuthGateway } from "./ports";

/**
 * Signs a user out of every session (browsers and impersonations). A session cached in a
 * cookie lasts until the cache expires (60 s); after that the user must sign in again.
 */
export async function revokeUserSessions(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly gateway: AdminAuthGateway;
  },
  admin: AdminActor,
  input: { readonly userId: string }
): Promise<{ readonly userId: string; readonly sessionCount: number }> {
  requireNotSelf(admin.userId, input.userId, "sign out");
  const target = await findTargetUser(deps.db, input.userId);
  const sessionCount = await deps.gateway.revokeSessions(target.id);
  await recordAuditEvent(deps, deps.requestContext, {
    action: "user.sessions_revoked",
    actor: { kind: "admin", userId: admin.userId },
    target: { type: "user", id: target.id },
    metadata: { sessionCount },
  });
  return { userId: target.id, sessionCount };
}
