import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import {
  type AdminActor,
  type PlatformRole,
  platformRoleOf,
  requireAnotherAdminRemains,
  requireNotSelf,
} from "./domain";
import { countActiveAdmins, findTargetUser } from "./lookups";
import type { AdminAuthGateway } from "./ports";

/**
 * Makes a user an admin or a regular user. Not your own role, and never demotes the last
 * active admin. Setting the role a user already has changes and records nothing.
 */
export async function setUserRole(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly gateway: AdminAuthGateway;
  },
  admin: AdminActor,
  input: { readonly userId: string; readonly role: PlatformRole }
): Promise<{ readonly userId: string; readonly role: PlatformRole }> {
  requireNotSelf(admin.userId, input.userId, "change the role of");
  const target = await findTargetUser(deps.db, input.userId);
  const previousRole = platformRoleOf(target.role);
  if (previousRole === input.role)
    return { userId: target.id, role: input.role };
  if (input.role !== "admin") {
    requireAnotherAdminRemains(
      target,
      await countActiveAdmins(deps.db, deps.clock.now()),
      deps.clock.now()
    );
  }

  await deps.gateway.setRole(target.id, input.role);
  await recordAuditEvent(deps, deps.requestContext, {
    action: "user.role_changed",
    actor: { kind: "admin", userId: admin.userId },
    target: { type: "user", id: target.id },
    metadata: { previousRole, role: input.role },
  });
  return { userId: target.id, role: input.role };
}
