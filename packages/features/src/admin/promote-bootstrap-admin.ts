import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { normalizeEmail } from "../workspaces";
import { hasAdminRole, platformRoleOf } from "./domain";
import type { AdminAuthGateway } from "./ports";

/**
 * Makes the BOOTSTRAP_ADMIN_EMAIL account a platform admin once its address is verified
 * (at verification, or at sign-up for providers that verify it, such as Google). Runs
 * from the auth library's user hooks; does nothing for any other account, an unverified
 * one, or one that is already an admin. Recorded with the system as actor.
 *
 * The same for the QA admin (`qaAdminEmail`, `qa+admin@<QA_EMAIL_DOMAIN>`, passed only
 * while QA_BYPASS=on), recorded as `qa.admin.promoted`: only QA-token holders can create
 * that account and read its verification mail (the QA outbox).
 */
export async function promoteBootstrapAdmin(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly gateway: AdminAuthGateway;
  },
  input: {
    readonly user: {
      readonly id: string;
      readonly email: string;
      readonly emailVerified: boolean;
      readonly role?: string | null;
    };
    readonly bootstrapAdminEmail: string | null;
    /** The QA admin's address while QA_BYPASS=on, else null. */
    readonly qaAdminEmail?: string | null;
  }
): Promise<{ readonly promoted: boolean }> {
  const { user, bootstrapAdminEmail } = input;
  const email = normalizeEmail(user.email);
  const bootstrap =
    bootstrapAdminEmail !== null &&
    email === normalizeEmail(bootstrapAdminEmail);
  const qa =
    !bootstrap &&
    Boolean(input.qaAdminEmail) &&
    email === normalizeEmail(input.qaAdminEmail as string);
  if ((!bootstrap && !qa) || !user.emailVerified || hasAdminRole(user.role)) {
    return { promoted: false };
  }
  await deps.gateway.setRole(user.id, "admin");
  await recordAuditEvent(
    deps,
    deps.requestContext,
    qa
      ? {
          action: "qa.admin.promoted",
          actor: { kind: "system", userId: null },
          target: { type: "user", id: user.id },
          metadata: { previousRole: platformRoleOf(user.role) },
        }
      : {
          action: "user.role_changed",
          actor: { kind: "system", userId: null },
          target: { type: "user", id: user.id },
          metadata: { previousRole: platformRoleOf(user.role), role: "admin" },
        }
  );
  return { promoted: true };
}
