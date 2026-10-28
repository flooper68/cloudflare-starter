import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { type AdminActor, requireImpersonable, requireNotSelf } from "./domain";
import { findTargetUser } from "./lookups";
import type { AdminAuthGateway } from "./ports";

/**
 * Starts acting as another user in this browser, for up to an hour (the auth library's
 * impersonation session). Never admins or suspended users, never yourself. Everything done
 * meanwhile is the user's, with the admin recorded as impersonator.
 */
export async function startImpersonation(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly gateway: AdminAuthGateway;
  },
  admin: AdminActor,
  input: { readonly userId: string }
): Promise<{ readonly userId: string }> {
  requireNotSelf(admin.userId, input.userId, "impersonate");
  const target = await findTargetUser(deps.db, input.userId);
  requireImpersonable(target, deps.clock.now());

  await deps.gateway.startImpersonation(target.id);
  await recordAuditEvent(deps, deps.requestContext, {
    action: "impersonation.started",
    actor: { kind: "admin", userId: admin.userId },
    target: { type: "user", id: target.id },
  });
  return { userId: target.id };
}
