import { and, count, lte } from "drizzle-orm";

import { user } from "../accounts";
import type { AdminActor } from "../admin";
import { countAuditEvents } from "../audit";
import type { Database } from "../database";
import type { Clock } from "../kernel";
import {
  DAY_MS,
  DEMO_STATS_ERASED_DAYS,
  type DemoRetentionPolicy,
} from "./domain";
import { retentionSubjects } from "./retention-subjects";

export interface DemoStats {
  readonly retentionDays: number;
  /** Accounts the retention applies to (not admins, protected or QA accounts). */
  readonly activeAccounts: number;
  /** Of those, the ones due for erasure by the end of today (UTC), overdue ones included. */
  readonly scheduledToday: number;
  /** Accounts the retention erased in the last DEMO_STATS_ERASED_DAYS days. */
  readonly erasedLast7Days: number;
}

/**
 * The demo instance's counters for the admin overview (DEMO_MODE=on): active demo
 * accounts, deletions scheduled today and accounts erased in the last 7 days
 * (`demo.account_erased` events). "Scheduled" is by age; an account is erased only once
 * it was warned, so one never warned is erased a day later than scheduled.
 */
export async function getDemoStats(
  deps: { readonly db: Database; readonly clock: Clock },
  _admin: AdminActor,
  policy: DemoRetentionPolicy
): Promise<DemoStats> {
  const now = deps.clock.now();
  const endOfToday =
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) +
    DAY_MS;
  const subjects = retentionSubjects(policy);
  const [active, scheduled, erased] = await Promise.all([
    deps.db.select({ n: count() }).from(user).where(subjects),
    deps.db
      .select({ n: count() })
      .from(user)
      .where(
        and(
          subjects,
          lte(
            user.createdAt,
            new Date(endOfToday - policy.retentionDays * DAY_MS)
          )
        )
      ),
    countAuditEvents(deps, {
      action: "demo.account_erased",
      since: new Date(now.getTime() - DEMO_STATS_ERASED_DAYS * DAY_MS),
    }),
  ]);
  return {
    retentionDays: policy.retentionDays,
    activeAccounts: active[0]?.n ?? 0,
    scheduledToday: scheduled[0]?.n ?? 0,
    erasedLast7Days: erased,
  };
}
