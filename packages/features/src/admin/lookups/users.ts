import { and, count, eq, isNull, like, lte, or } from "drizzle-orm";

import { user } from "../../accounts";
import type { Database } from "../../database";
import { type AdminTarget, AdminUserNotFoundError } from "../domain";

/** Reads shared by the admin use cases (not use cases themselves). */

export interface TargetUser extends AdminTarget {
  readonly email: string;
  readonly name: string;
}

/** The user an admin acts on, or AdminUserNotFoundError. */
export async function findTargetUser(
  db: Database,
  userId: string
): Promise<TargetUser> {
  const [row] = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      banned: user.banned,
      banExpires: user.banExpires,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!row) throw new AdminUserNotFoundError();
  return {
    ...row,
    banned: row.banned ?? false,
    banExpires: row.banExpires ?? null,
  };
}

/**
 * Admins whose suspension is not in force at `now`. `role` may be a comma list, so the
 * match is on the list's items.
 */
export async function countActiveAdmins(
  db: Database,
  now: Date
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(user)
    .where(
      and(
        or(
          eq(user.role, "admin"),
          like(user.role, "admin,%"),
          like(user.role, "%,admin"),
          like(user.role, "%,admin,%")
        ),
        or(
          eq(user.banned, false),
          isNull(user.banned),
          lte(user.banExpires, now)
        )
      )
    );
  return row?.value ?? 0;
}
