import { eq } from "drizzle-orm";

import { isAnyQaAdminEmail } from "../abuse";
import { user as users } from "../accounts";
import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { RequestContext } from "../kernel";
import { hasAdminRole } from "./domain";
import type { AdminAuthGateway } from "./ports";

/**
 * Takes the admin role, and every session, from a QA admin account (`qa+admin@…`) that is
 * not the current QA admin (QA_BYPASS=off, or an old QA_EMAIL_DOMAIN), recorded as
 * `qa.admin.demoted`. Runs at each sign-in of such an account (server/qa-admin.ts); access
 * is refused before that anyway (findAdminAccess). Does nothing for any other account or
 * one that is no admin.
 */
export async function demoteQaAdmin(
  deps: {
    readonly db: Database;
    readonly clock: { now(): Date };
    readonly ids: { uuid(): string };
    readonly requestContext: RequestContext;
    readonly gateway: AdminAuthGateway;
  },
  input: { readonly userId: string }
): Promise<{ readonly demoted: boolean }> {
  const [row] = await deps.db
    .select({ email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  if (!row || !isAnyQaAdminEmail(row.email) || !hasAdminRole(row.role)) {
    return { demoted: false };
  }
  await deps.gateway.setRole(input.userId, "user");
  await deps.gateway.revokeSessions(input.userId);
  await recordAuditEvent(deps, deps.requestContext, {
    action: "qa.admin.demoted",
    actor: { kind: "system", userId: null },
    target: { type: "user", id: input.userId },
  });
  return { demoted: true };
}
