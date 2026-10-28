import { and, count, eq, gte, isNull, sql } from "drizzle-orm";

import { session, user } from "../accounts";
import type { Database } from "../database";
import type { Clock } from "../kernel";
import { workspaceMembers, workspaces } from "../workspaces";
import {
  type AdminActor,
  type DailyCount,
  dailySeries,
  OVERVIEW_DAYS,
  type SizeBucket,
  windowStart,
  workspaceSizeBuckets,
} from "./domain";

export interface AdminOverview {
  readonly users: {
    readonly total: number;
    readonly admins: number;
    readonly banned: number;
  };
  /** New accounts per UTC day, the last OVERVIEW_DAYS days, oldest first. */
  readonly signUps: readonly DailyCount[];
  /** Users with a sign-in (a new session, impersonation aside) per UTC day. */
  readonly activeUsers: readonly DailyCount[];
  readonly workspaces: {
    readonly total: number;
    readonly shared: number;
    readonly personal: number;
    readonly sizes: readonly SizeBucket[];
  };
  /** Placeholder for the billing feature: plans and trials. Null until it exists. */
  readonly plans: null;
  /** Placeholder for the billing feature: usage against plan limits. Null until it exists. */
  readonly usage: null;
}

const day = (column: unknown) =>
  sql<string>`date(${column} / 1000, 'unixepoch')`;

/**
 * The admin overview, from D1 only: user counts, daily sign-ups (user.created_at), daily
 * active users (users with a new session that day; sessions expire and are deleted, so
 * older days undercount), workspace counts and sizes.
 */
export async function getAdminOverview(
  deps: { readonly db: Database; readonly clock: Clock },
  _admin: AdminActor
): Promise<AdminOverview> {
  const now = deps.clock.now();
  const start = windowStart(now, OVERVIEW_DAYS);

  const [users, signUps, active, kinds, sizes] = await Promise.all([
    deps.db
      .select({
        total: count(),
        admins: sql<number>`sum(case when (',' || coalesce(${user.role}, '') || ',') like '%,admin,%' then 1 else 0 end)`,
        banned: sql<number>`sum(case when ${user.banned} = 1 and (${user.banExpires} is null or ${user.banExpires} > ${now.getTime()}) then 1 else 0 end)`,
      })
      .from(user),
    deps.db
      .select({ date: day(user.createdAt), count: count() })
      .from(user)
      .where(gte(user.createdAt, start))
      .groupBy(day(user.createdAt)),
    deps.db
      .select({
        date: day(session.createdAt),
        count: sql<number>`count(distinct ${session.userId})`,
      })
      .from(session)
      .where(and(gte(session.createdAt, start), isNull(session.impersonatedBy)))
      .groupBy(day(session.createdAt)),
    deps.db
      .select({ kind: workspaces.kind, count: count() })
      .from(workspaces)
      .groupBy(workspaces.kind),
    deps.db
      .select({ members: count() })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(eq(workspaces.kind, "shared"))
      .groupBy(workspaceMembers.workspaceId),
  ]);

  const kindCount = (kind: "personal" | "shared") =>
    kinds.find((row) => row.kind === kind)?.count ?? 0;
  return {
    users: {
      total: users[0]?.total ?? 0,
      admins: Number(users[0]?.admins ?? 0),
      banned: Number(users[0]?.banned ?? 0),
    },
    signUps: dailySeries(start, OVERVIEW_DAYS, signUps),
    activeUsers: dailySeries(
      start,
      OVERVIEW_DAYS,
      active.map((row) => ({ date: row.date, count: Number(row.count) }))
    ),
    workspaces: {
      total: kindCount("personal") + kindCount("shared"),
      shared: kindCount("shared"),
      personal: kindCount("personal"),
      sizes: workspaceSizeBuckets(sizes.map((row) => row.members)),
    },
    plans: null,
    usage: null,
  };
}
