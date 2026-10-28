import { and, desc, eq, gt } from "drizzle-orm";

import { account, session, user } from "../accounts";
import type { Database } from "../database";
import type { Clock } from "../kernel";
import { workspaceMembers, workspaces } from "../workspaces";
import {
  type AdminActor,
  AdminUserNotFoundError,
  isBanActive,
  type PlatformRole,
  platformRoleOf,
} from "./domain";

/** A session of the user, without its token. */
export interface AdminSessionRow {
  readonly id: string;
  readonly createdAt: Date;
  readonly lastActiveAt: Date;
  readonly expiresAt: Date;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  /** The admin impersonating the user in this session, if any. */
  readonly impersonatedBy: string | null;
}

export interface AdminUserDetail {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly image: string | null;
  readonly role: PlatformRole;
  readonly ban: {
    readonly active: boolean;
    readonly reason: string | null;
    readonly expiresAt: Date | null;
  };
  /** Sign-in methods from the user's accounts: `credential` (email + password), `google`, … */
  readonly signInMethods: readonly string[];
  readonly createdAt: Date;
  readonly lastSeenAt: Date | null;
  readonly workspaces: readonly {
    readonly id: string;
    readonly name: string;
    readonly kind: "personal" | "shared";
    readonly role: string;
    readonly joinedAt: Date;
  }[];
  /** Sessions that have not expired, most recently active first. */
  readonly sessions: readonly AdminSessionRow[];
}

/**
 * Everything the admin portal shows about one user: profile, verification, sign-in
 * methods, suspension, workspaces with roles, and open sessions (never their tokens).
 */
export async function getUserDetail(
  deps: { readonly db: Database; readonly clock: Clock },
  _admin: AdminActor,
  input: { readonly userId: string }
): Promise<AdminUserDetail> {
  const now = deps.clock.now();
  const [row] = await deps.db
    .select()
    .from(user)
    .where(eq(user.id, input.userId))
    .limit(1);
  if (!row) throw new AdminUserNotFoundError();

  const [accounts, memberships, sessions] = await Promise.all([
    deps.db
      .select({ providerId: account.providerId })
      .from(account)
      .where(eq(account.userId, row.id)),
    deps.db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        kind: workspaces.kind,
        role: workspaceMembers.role,
        joinedAt: workspaceMembers.createdAt,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(eq(workspaceMembers.userId, row.id))
      .orderBy(workspaces.name),
    deps.db
      .select({
        id: session.id,
        createdAt: session.createdAt,
        lastActiveAt: session.updatedAt,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        impersonatedBy: session.impersonatedBy,
      })
      .from(session)
      .where(and(eq(session.userId, row.id), gt(session.expiresAt, now)))
      .orderBy(desc(session.updatedAt)),
  ]);

  const banExpires = row.banExpires ?? null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified,
    image: row.image ?? null,
    role: platformRoleOf(row.role),
    ban: {
      active: isBanActive({ banned: row.banned ?? false, banExpires }, now),
      reason: row.banReason ?? null,
      expiresAt: banExpires,
    },
    signInMethods: [
      ...new Set(accounts.map((entry) => entry.providerId)),
    ].sort(),
    createdAt: row.createdAt,
    lastSeenAt: sessions[0]?.lastActiveAt ?? null,
    workspaces: memberships,
    sessions,
  };
}
