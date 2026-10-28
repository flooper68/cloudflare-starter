import type { Database } from "../database";
import type { Clock } from "../kernel";
import { type BillingSettings, checkLimit, isMetricKey } from "./domain";
import { measureMetric } from "./measure-metric";
import { resolveEntitlements } from "./resolve-entitlements";

/**
 * Throws LimitReachedError (`limit_reached`, with the limit, the current value and upgrade
 * options) when adding `increment` to the workspace's `metric` would pass its limit. An
 * unlimited metric is not measured. The caller has checked the actor's permission first.
 * Check-then-act: concurrent requests can overshoot a limit by what they add together.
 */
export async function assertLimit(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly settings: BillingSettings;
  },
  workspaceId: string,
  metric: string,
  increment: number
): Promise<void> {
  if (!isMetricKey(metric))
    throw new Error(`Unknown billing metric ${metric}: add it to METRICS`);
  if (deps.settings.mode === "off") return;
  const { entitlements } = await resolveEntitlements(deps, workspaceId);
  if (entitlements.limits[metric] === null) return;
  const current = await measureMetric(deps, workspaceId, metric);
  checkLimit(entitlements, metric, current, increment);
}
