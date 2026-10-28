import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { type AdminActor, requireNotSelf } from "./domain";
import { findTargetUser } from "./lookups";
import type { AdminAuthGateway } from "./ports";

/** Lifts a user's suspension; they can sign in again. Recorded only when one was set. */
export async function unbanUser(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly gateway: AdminAuthGateway;
  },
  admin: AdminActor,
  input: { readonly userId: string }
): Promise<{ readonly userId: string; readonly changed: boolean }> {
  requireNotSelf(admin.userId, input.userId, "lift the suspension of");
  const target = await findTargetUser(deps.db, input.userId);
  if (!target.banned) return { userId: target.id, changed: false };

  await deps.gateway.unban(target.id);
  await recordAuditEvent(deps, deps.requestContext, {
    action: "user.unbanned",
    actor: { kind: "admin", userId: admin.userId },
    target: { type: "user", id: target.id },
  });
  return { userId: target.id, changed: true };
}
