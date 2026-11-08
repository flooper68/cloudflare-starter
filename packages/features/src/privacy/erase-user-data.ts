import type { AdminActor, AdminAuthGateway } from "../admin";
import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import {
  type Clock,
  DomainError,
  type Ids,
  type RequestContext,
} from "../kernel";
import { eraseAccount } from "./erase-account";
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
  const plan = await eraseAccount(deps, {
    userId: input.userId,
    actor: { kind: "admin", userId: admin.userId },
  });
  await recordAuditEvent(deps, deps.requestContext, {
    action: "user.deleted",
    actor: { kind: "admin", userId: admin.userId },
    target: { type: "user", id: input.userId },
  });
  return { userId: input.userId, erased: true, ...plan };
}
