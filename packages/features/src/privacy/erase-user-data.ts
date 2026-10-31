import type { AdminActor, AdminAuthGateway } from "../admin";
import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import {
  type Clock,
  DomainError,
  type Ids,
  type RequestContext,
} from "../kernel";
import { prepareUserErasure } from "./prepare-user-erasure";
/** Administrator path shares the same preflight/erasers as self-service deletion. */
export async function eraseUserData(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly gateway: AdminAuthGateway;
    readonly eraseUserArtifacts: (input: {
      userId: string;
      email: string;
    }) => Promise<void>;
    readonly eraseWorkspaceArtifacts: (
      ids: readonly string[],
      userId: string
    ) => Promise<void>;
  },
  admin: AdminActor,
  input: { readonly userId: string }
) {
  if (admin.userId === input.userId)
    throw new DomainError(
      "forbidden",
      "Use account settings to delete your own account",
      "CANNOT_ERASE_SELF_AS_ADMIN"
    );
  const operationId = deps.ids.uuid();
  const plan = await prepareUserErasure(deps, {
    userId: input.userId,
    operationId,
    actor: { kind: "admin", userId: admin.userId },
  });
  await deps.gateway.deleteUser(input.userId, operationId);
  await recordAuditEvent(deps, deps.requestContext, {
    action: "user.deleted",
    actor: { kind: "admin", userId: admin.userId },
    target: { type: "user", id: input.userId },
  });
  return { userId: input.userId, erased: true, ...plan };
}
