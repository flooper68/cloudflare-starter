import type { Database } from "../database";
import type { Clock } from "../kernel";
import {
  type BillingSettings,
  METRICS,
  type MetricKey,
  usagePeriod,
} from "./domain";
import { measureMetric } from "./measure-metric";
import { resolveEntitlements } from "./resolve-entitlements";

export interface UsageLine {
  readonly metric: MetricKey;
  readonly kind: "current" | "period";
  readonly unit: "bytes" | "count";
  readonly used: number;
  /** null is unlimited. */
  readonly limit: number | null;
}

export interface UsageSummary {
  readonly planId: string;
  /** The period of the `period` metrics, `YYYY-MM`. */
  readonly period: string;
  readonly metrics: readonly UsageLine[];
}

/**
 * Every metric of the catalog for a workspace: what it uses now (this period for counters)
 * against its limit. For a workspace the caller has already authorized (a member through
 * getBillingSummary, or a platform admin).
 */
export async function getUsageSummary(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly settings: BillingSettings;
  },
  workspaceId: string
): Promise<UsageSummary> {
  const { entitlements } = await resolveEntitlements(deps, workspaceId);
  const metrics = Object.keys(METRICS) as MetricKey[];
  const used = await Promise.all(
    metrics.map((metric) => measureMetric(deps, workspaceId, metric))
  );
  return {
    planId: entitlements.planId,
    period: usagePeriod(deps.clock.now()),
    metrics: metrics.map((metric, index) => ({
      metric,
      kind: METRICS[metric].kind,
      unit: METRICS[metric].unit,
      used: used[index] ?? 0,
      limit: entitlements.limits[metric],
    })),
  };
}
