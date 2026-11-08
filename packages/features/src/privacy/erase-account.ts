import type { AdminAuthGateway } from "../admin";
import type { AuditActor } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { prepareUserErasure } from "./prepare-user-erasure";

/**
 * The erasure every server-initiated deletion shares (the admin portal's `eraseUserData`,
 * the demo retention): the preflight and erasers of `prepareUserErasure` (last-owner and
 * last-admin checks first, then workspaces, files, exports, images, identity references
 * and audit redaction), then Better Auth's delete under the same operation id, whose
 * hooks complete it (`completeUserErasure`: erasure record, `privacy.user_erased`,
 * confirmation mail). The caller records its own audit event.
 */
export async function eraseAccount(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly gateway: Pick<AdminAuthGateway, "deleteUser">;
    readonly eraseUserArtifacts: (input: {
      userId: string;
      email: string;
    }) => Promise<void>;
    readonly eraseWorkspaceArtifacts: (
      ids: readonly string[],
      userId: string
    ) => Promise<void>;
  },
  input: { readonly userId: string; readonly actor: AuditActor }
) {
  const operationId = deps.ids.uuid();
  const plan = await prepareUserErasure(deps, {
    userId: input.userId,
    operationId,
    actor: input.actor,
  });
  await deps.gateway.deleteUser(input.userId, operationId);
  return plan;
}
