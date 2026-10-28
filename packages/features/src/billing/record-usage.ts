import { sql } from "drizzle-orm";

import type { Database } from "../database";
import type { Clock } from "../kernel";
import { usageCounter } from "./billing.schema";
import {
  type BillingSettings,
  isMetricKey,
  METRICS,
  usagePeriod,
} from "./domain";

/**
 * Adds `amount` to the workspace's counter of a `period` metric for the current period
 * (`YYYY-MM`), creating it; one atomic upsert. A new period starts a new row, so counters
 * reset by themselves. Nothing is counted with BILLING=off.
 */
export async function recordUsage(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly settings: BillingSettings;
  },
  workspaceId: string,
  metric: string,
  amount: number
): Promise<void> {
  if (!isMetricKey(metric) || METRICS[metric].kind !== "period")
    throw new Error(`${metric} is not a period metric in METRICS`);
  if (deps.settings.mode === "off" || amount === 0) return;
  await deps.db
    .insert(usageCounter)
    .values({
      workspaceId,
      metric,
      period: usagePeriod(deps.clock.now()),
      value: amount,
    })
    .onConflictDoUpdate({
      target: [
        usageCounter.workspaceId,
        usageCounter.metric,
        usageCounter.period,
      ],
      set: { value: sql`${usageCounter.value} + excluded.value` },
    });
}
