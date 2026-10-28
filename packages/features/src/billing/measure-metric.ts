import { and, eq } from "drizzle-orm";

import type { Database } from "../database";
import { measureWorkspaceStorage } from "../files";
import type { Clock } from "../kernel";
import { countWorkspaceSeats } from "../workspaces";
import { usageCounter } from "./billing.schema";
import { METRICS, type MetricKey, usagePeriod } from "./domain";

type Measure = (
  deps: { readonly db: Database; readonly clock: Clock },
  input: { readonly workspaceId: string }
) => Promise<number>;

/**
 * The functions behind `current` metrics, by the catalog's `source`. A new current metric
 * adds its source here (test/architecture/entitlements.test.ts checks every one resolves).
 */
const CURRENT_SOURCES: Readonly<Record<string, Measure>> = {
  "files.measureWorkspaceStorage": measureWorkspaceStorage,
  "workspaces.countWorkspaceSeats": countWorkspaceSeats,
};

/**
 * A workspace's value of a metric now: measured from the owning feature's tables for a
 * `current` metric, the counter of the current period (0 without one) for a `period` one.
 */
export async function measureMetric(
  deps: { readonly db: Database; readonly clock: Clock },
  workspaceId: string,
  metric: MetricKey
): Promise<number> {
  const definition = METRICS[metric];
  if (definition.kind === "period") {
    const [row] = await deps.db
      .select({ value: usageCounter.value })
      .from(usageCounter)
      .where(
        and(
          eq(usageCounter.workspaceId, workspaceId),
          eq(usageCounter.metric, metric),
          eq(usageCounter.period, usagePeriod(deps.clock.now()))
        )
      );
    return row?.value ?? 0;
  }
  const measure = CURRENT_SOURCES[definition.source];
  if (!measure)
    throw new Error(
      `No measuring function for metric ${metric} (source ${definition.source})`
    );
  return measure(deps, { workspaceId });
}
