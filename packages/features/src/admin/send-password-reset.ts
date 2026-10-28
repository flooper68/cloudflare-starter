import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import type { AdminActor } from "./domain";
import { findTargetUser } from "./lookups";
import type { AdminAuthGateway } from "./ports";

/**
 * Emails a user a password reset link, the same mail as "Forgot password". The admin never
 * sees the link. Fails with PasswordResetUnavailableError where email is not configured.
 */
export async function sendPasswordReset(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly gateway: AdminAuthGateway;
  },
  admin: AdminActor,
  input: { readonly userId: string; readonly redirectTo: string }
): Promise<{ readonly userId: string; readonly email: string }> {
  const target = await findTargetUser(deps.db, input.userId);
  await deps.gateway.sendPasswordReset(target.email, input.redirectTo);
  await recordAuditEvent(deps, deps.requestContext, {
    action: "user.password_reset_sent",
    actor: { kind: "admin", userId: admin.userId },
    target: { type: "user", id: target.id },
  });
  return { userId: target.id, email: target.email };
}
