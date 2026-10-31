import { securityFactorChangedNotification } from "../accounts";
import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, Notify, RequestContext } from "../kernel";
import {
  type AdminActor,
  requireAnotherAdminRemains,
  requireNotSelf,
} from "./domain";
import { countActiveAdmins, findTargetUser } from "./lookups";
import type { AdminAuthGateway } from "./ports";

/** Recovery by another administrator; all old sessions and authorizations are revoked. */
export async function resetSecondFactor(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly gateway: AdminAuthGateway;
    readonly notify: Notify;
  },
  admin: AdminActor,
  input: { readonly userId: string }
) {
  requireNotSelf(
    admin.userId,
    input.userId,
    "reset two-factor authentication for"
  );
  const target = await findTargetUser(deps.db, input.userId);
  requireAnotherAdminRemains(
    target,
    await countActiveAdmins(deps.db, deps.clock.now()),
    deps.clock.now()
  );
  await deps.gateway.resetSecondFactor(target.id);
  await recordAuditEvent(deps, deps.requestContext, {
    action: "user.second_factor_reset",
    actor: { kind: "admin", userId: admin.userId },
    target: { type: "user", id: target.id },
  });
  await deps.notify(securityFactorChangedNotification, {
    recipients: [target.id],
    data: { change: "reset by an administrator" },
    context: { workspaceId: null, requestContext: deps.requestContext },
  });
  return { userId: target.id };
}
