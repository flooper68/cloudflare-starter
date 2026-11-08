import type { AdminAuthGateway } from "../admin";
import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { eraseAccount } from "../privacy";

/**
 * Erases one expired demo account through the privacy erasure (`eraseAccount`: the same
 * preflight, erasers and Better Auth delete hooks as an admin's or the person's own
 * deletion), as the system, then records `demo.account_erased`. Its personal workspace,
 * and every shared workspace it was the only member of, go with it; it leaves the
 * others. Throws LastOwnerError, before changing anything, while it is the last owner
 * of a workspace others still use.
 */
export async function eraseDemoAccount(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly authUsers: Pick<AdminAuthGateway, "deleteUser">;
    readonly eraseUserArtifacts: (input: {
      userId: string;
      email: string;
    }) => Promise<void>;
    readonly eraseWorkspaceArtifacts: (
      ids: readonly string[],
      userId: string
    ) => Promise<void>;
  },
  input: { readonly userId: string; readonly retentionDays: number }
) {
  const plan = await eraseAccount(
    { ...deps, gateway: deps.authUsers },
    { userId: input.userId, actor: { kind: "system" } }
  );
  await recordAuditEvent(deps, deps.requestContext, {
    action: "demo.account_erased",
    actor: { kind: "system" },
    workspaceId: null,
    target: { type: "user", id: input.userId },
    metadata: { retentionDays: input.retentionDays },
  });
  return plan;
}
