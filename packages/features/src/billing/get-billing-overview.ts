import { and, count, eq, gt, isNull, sql, sum } from "drizzle-orm";

import type { Database } from "../database";
import type { Clock } from "../kernel";
import { workspaces } from "../workspaces";
import { usageCounter, workspaceSubscription } from "./billing.schema";
import {
  type BillingSettings,
  DEFAULT_PLAN_ID,
  findPlan,
  METRICS,
  type MetricKey,
  usagePeriod,
} from "./domain";

/** Trials ending within this many days count as ending soon. */
const TRIAL_ENDING_SOON_DAYS = 7;

export interface BillingOverview {
  /** Workspaces per plan and subscription status; no subscription row is the default plan. */
  readonly plans: readonly {
    readonly planId: string;
    readonly planName: string;
    readonly status: string | null;
    readonly workspaces: number;
  }[];
  readonly trials: {
    readonly active: number;
    /** Trials that end within 7 days. */
    readonly endingSoon: number;
  };
  /** Counter metrics this period, summed over every workspace. */
  readonly usage: {
    readonly period: string;
    readonly metrics: readonly {
      readonly metric: MetricKey;
      readonly unit: "bytes" | "count";
      readonly total: number;
    }[];
  };
}

/**
 * The whole app's billing at a glance, for the admin overview: workspaces per plan and
 * status, trials, and this period's usage counters. Null with BILLING=off (no plans).
 * Group-by queries over the billing tables; nothing per workspace.
 */
export async function getBillingOverview(deps: {
  readonly db: Database;
  readonly clock: Clock;
  readonly settings: BillingSettings;
}): Promise<BillingOverview | null> {
  if (deps.settings.mode === "off") return null;
  const now = deps.clock.now();
  const soon = new Date(
    now.getTime() + TRIAL_ENDING_SOON_DAYS * 24 * 60 * 60 * 1000
  );
  const period = usagePeriod(now);
  const counterMetrics = (Object.keys(METRICS) as MetricKey[]).filter(
    (metric) => METRICS[metric].kind === "period"
  );

  const [byPlan, withoutSubscription, trials, counters] = await Promise.all([
    deps.db
      .select({
        planId: workspaceSubscription.planId,
        status: workspaceSubscription.status,
        workspaces: count(),
      })
      .from(workspaceSubscription)
      .groupBy(workspaceSubscription.planId, workspaceSubscription.status),
    deps.db
      .select({ value: count() })
      .from(workspaces)
      .leftJoin(
        workspaceSubscription,
        eq(workspaceSubscription.workspaceId, workspaces.id)
      )
      .where(isNull(workspaceSubscription.workspaceId)),
    deps.db
      .select({
        active: count(),
        endingSoon: sql<number>`sum(case when ${workspaceSubscription.trialEndsAt} <= ${soon.getTime()} then 1 else 0 end)`,
      })
      .from(workspaceSubscription)
      .where(
        and(
          eq(workspaceSubscription.status, "trialing"),
          gt(workspaceSubscription.trialEndsAt, now)
        )
      ),
    deps.db
      .select({ metric: usageCounter.metric, total: sum(usageCounter.value) })
      .from(usageCounter)
      .where(eq(usageCounter.period, period))
      .groupBy(usageCounter.metric),
  ]);

  const defaults = withoutSubscription[0]?.value ?? 0;
  const plans = [
    ...byPlan.map((row) => ({
      planId: row.planId,
      planName: findPlan(row.planId)?.name ?? row.planId,
      status: row.status as string | null,
      workspaces: row.workspaces,
    })),
    ...(defaults > 0
      ? [
          {
            planId: DEFAULT_PLAN_ID,
            planName: findPlan(DEFAULT_PLAN_ID)?.name ?? DEFAULT_PLAN_ID,
            status: null,
            workspaces: defaults,
          },
        ]
      : []),
  ].sort((a, b) => b.workspaces - a.workspaces);

  return {
    plans,
    trials: {
      active: trials[0]?.active ?? 0,
      endingSoon: Number(trials[0]?.endingSoon ?? 0),
    },
    usage: {
      period,
      metrics: counterMetrics.map((metric) => ({
        metric,
        unit: METRICS[metric].unit,
        total: Number(
          counters.find((row) => row.metric === metric)?.total ?? 0
        ),
      })),
    },
  };
}
