import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { prepareUserDeletion } from "../workspaces";
import {
  type AdminActor,
  requireAnotherAdminRemains,
  requireNotSelf,
} from "./domain";
import { countActiveAdmins, findTargetUser } from "./lookups";
import type { AdminAuthGateway } from "./ports";

/**
 * Deletes a user's account. Their workspaces follow the account-deletion rules
 * (prepareUserDeletion): workspaces only they use are deleted with their files, they leave
 * shared ones, and the deletion is refused (LastOwnerError) while they are the last owner
 * of a workspace others still use; an admin then assigns another owner first. Not
 * yourself, and never the last active admin.
 */
export async function removeUser(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly gateway: AdminAuthGateway;
    readonly purgeWorkspaceFiles: (
      workspaceIds: readonly string[]
    ) => Promise<void>;
  },
  admin: AdminActor,
  input: { readonly userId: string }
): Promise<{
  readonly userId: string;
  readonly deletedWorkspaceIds: readonly string[];
  readonly leftWorkspaceIds: readonly string[];
}> {
  requireNotSelf(admin.userId, input.userId, "delete");
  const target = await findTargetUser(deps.db, input.userId);
  requireAnotherAdminRemains(
    target,
    await countActiveAdmins(deps.db, deps.clock.now()),
    deps.clock.now()
  );

  const actor = { kind: "admin" as const, userId: admin.userId };
  // Before anything is deleted, so a refusal (last owner) leaves the account intact.
  const workspaces = await prepareUserDeletion(deps, {
    userId: target.id,
    actor,
  });
  await deps.gateway.deleteUser(target.id);
  await recordAuditEvent(deps, deps.requestContext, {
    action: "user.deleted",
    actor,
    target: { type: "user", id: target.id },
  });
  return { userId: target.id, ...workspaces };
}
