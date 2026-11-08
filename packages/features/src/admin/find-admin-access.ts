import { and, desc, eq, isNull } from "drizzle-orm";

import { isAnyQaAdminEmail } from "../abuse";
import { session, user } from "../accounts";
import type { Database } from "../database";
import type { Clock } from "../kernel";
import { hasAdminRole, isBanActive } from "./domain";

export interface AdminAccess {
  /** Role admin and not suspended, read from D1 (never from a cookie-cached session). */
  readonly isAdmin: boolean;
  /**
   * When the user last signed in themselves: their newest session that is not an
   * impersonation, or null. Used for destructive actions called without a browser
   * session (MCP).
   */
  readonly lastSignInAt: Date | null;
}

/**
 * Whether the user may use the admin portal now, and when they last signed in. The
 * admin procedures call it on every request, so a demoted or suspended admin loses
 * access at once.
 */
export async function findAdminAccess(
  deps: { readonly db: Database; readonly clock: Clock },
  input: {
    readonly userId: string;
    /**
     * QA_BYPASS is off: a QA admin account (`qa+admin@…`) is no admin whatever its
     * stored role (docs/guides/how-to-configure-abuse-protection.md#the-qa-admin).
     */
    readonly qaBypassOff?: boolean;
  }
): Promise<AdminAccess> {
  const [row] = await deps.db
    .select({
      email: user.email,
      role: user.role,
      banned: user.banned,
      banExpires: user.banExpires,
    })
    .from(user)
    .where(eq(user.id, input.userId))
    .limit(1);
  if (!row || !hasAdminRole(row.role)) {
    return { isAdmin: false, lastSignInAt: null };
  }
  if (input.qaBypassOff && isAnyQaAdminEmail(row.email)) {
    return { isAdmin: false, lastSignInAt: null };
  }
  const suspended = isBanActive(
    { banned: row.banned ?? false, banExpires: row.banExpires ?? null },
    deps.clock.now()
  );
  if (suspended) return { isAdmin: false, lastSignInAt: null };

  const [latest] = await deps.db
    .select({ createdAt: session.createdAt })
    .from(session)
    .where(
      and(eq(session.userId, input.userId), isNull(session.impersonatedBy))
    )
    .orderBy(desc(session.createdAt))
    .limit(1);
  return { isAdmin: true, lastSignInAt: latest?.createdAt ?? null };
}
