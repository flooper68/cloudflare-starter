import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  lte,
  max,
  not,
  or,
  type SQL,
  sql,
} from "drizzle-orm";

import { session, user } from "../accounts";
import type { Database } from "../database";
import type { Clock } from "../kernel";
import {
  type AdminActor,
  type AdminUserQueryInput,
  adminUserQuerySchema,
  decodeAdminCursor,
  encodeAdminCursor,
  isBanActive,
  likePattern,
  type PlatformRole,
  parseAdminQuery,
  platformRoleOf,
} from "./domain";

/** One row of the admin user list. */
export interface AdminUserRow {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly role: PlatformRole;
  /** Suspended right now (an expired suspension counts as lifted). */
  readonly banned: boolean;
  readonly banExpires: Date | null;
  readonly createdAt: Date;
  /** Last activity of any session, or null when the user has none left. */
  readonly lastSeenAt: Date | null;
}

export interface AdminUserPage {
  readonly items: readonly AdminUserRow[];
  /** Pass as `cursor` for the next page; null on the last page. */
  readonly nextCursor: string | null;
}

const ADMIN_ROLE_MATCH = sql`(',' || coalesce(${user.role}, '') || ',') like '%,admin,%'`;

/**
 * Every user of the app, newest first, filtered by a search on name or email, platform
 * role and status; keyset pagination on (created_at, id).
 */
export async function listUsers(
  deps: { readonly db: Database; readonly clock: Clock },
  _admin: AdminActor,
  input: AdminUserQueryInput = {}
): Promise<AdminUserPage> {
  const query = parseAdminQuery(adminUserQuerySchema, input);
  const now = deps.clock.now();
  const banInForce = and(
    eq(user.banned, true),
    or(isNull(user.banExpires), sql`${user.banExpires} > ${now.getTime()}`)
  ) as SQL;

  const conditions: (SQL | undefined)[] = [
    query.search
      ? or(
          sql`${user.email} like ${likePattern(query.search)} escape '\\'`,
          sql`${user.name} like ${likePattern(query.search)} escape '\\'`
        )
      : undefined,
    query.role === "admin" ? ADMIN_ROLE_MATCH : undefined,
    query.role === "user" ? not(ADMIN_ROLE_MATCH) : undefined,
    query.status === "banned" ? banInForce : undefined,
    query.status === "active"
      ? or(
          eq(user.banned, false),
          isNull(user.banned),
          lte(user.banExpires, now)
        )
      : undefined,
  ];
  if (query.cursor) {
    const cursor = decodeAdminCursor(query.cursor);
    const at = new Date(cursor.createdAtMs);
    conditions.push(
      or(
        lt(user.createdAt, at),
        and(eq(user.createdAt, at), lt(user.id, cursor.id))
      )
    );
  }

  const rows = await deps.db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      role: user.role,
      banned: user.banned,
      banExpires: user.banExpires,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(and(...conditions))
    .orderBy(desc(user.createdAt), desc(user.id))
    .limit(query.limit + 1);
  const page = rows.slice(0, query.limit);

  const seen = page.length
    ? await deps.db
        .select({ userId: session.userId, at: max(session.updatedAt) })
        .from(session)
        .where(
          inArray(
            session.userId,
            page.map((row) => row.id)
          )
        )
        .groupBy(session.userId)
    : [];
  const lastSeen = new Map(seen.map((row) => [row.userId, row.at]));

  const last = page.at(-1);
  return {
    items: page.map((row) => {
      const banExpires = row.banExpires ?? null;
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        emailVerified: row.emailVerified,
        role: platformRoleOf(row.role),
        banned: isBanActive({ banned: row.banned ?? false, banExpires }, now),
        banExpires,
        createdAt: row.createdAt,
        lastSeenAt: lastSeen.get(row.id) ?? null,
      };
    }),
    nextCursor:
      rows.length > query.limit && last
        ? encodeAdminCursor({
            createdAtMs: last.createdAt.getTime(),
            id: last.id,
          })
        : null,
  };
}
