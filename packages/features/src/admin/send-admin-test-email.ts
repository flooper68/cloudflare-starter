import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { type EmailService, testEmail } from "../platform";
import { type AdminActor, PasswordResetUnavailableError } from "./domain";

/**
 * An admin sends the test email to any address: the real sending path, to check that mail
 * from this deployment arrives (the weekly real-delivery check of the QA suite uses it).
 * Refused (unavailable) where email is off.
 */
export async function sendAdminTestEmail(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly email: EmailService;
  },
  admin: AdminActor,
  input: { readonly to: string; readonly environment: string }
): Promise<{ readonly sent: true }> {
  if (!deps.email.enabled) {
    throw new PasswordResetUnavailableError(
      "Email is not configured for this deployment"
    );
  }
  await deps.email.send(
    testEmail({ to: { email: input.to }, environment: input.environment })
  );
  await recordAuditEvent(deps, deps.requestContext, {
    action: "admin.test_email_sent",
    actor: { kind: "admin", userId: admin.userId },
    target: { type: "email", id: input.to.trim().toLowerCase() },
  });
  return { sent: true };
}
