import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { NotImpersonatingError } from "./domain";
import type { AdminAuthGateway } from "./ports";

/**
 * Ends an impersonation and returns the browser to the admin's own session. Called from
 * the impersonated session: `impersonatedBy` is the admin, `userId` the user being
 * impersonated (from that session, never from client input).
 */
export async function stopImpersonation(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly gateway: AdminAuthGateway;
  },
  input: {
    readonly userId: string;
    readonly impersonatedBy: string | null;
  }
): Promise<{ readonly adminUserId: string }> {
  if (!input.impersonatedBy) throw new NotImpersonatingError();
  await deps.gateway.stopImpersonation();
  await recordAuditEvent(deps, deps.requestContext, {
    action: "impersonation.stopped",
    actor: { kind: "admin", userId: input.impersonatedBy },
    target: { type: "user", id: input.userId },
  });
  return { adminUserId: input.impersonatedBy };
}
