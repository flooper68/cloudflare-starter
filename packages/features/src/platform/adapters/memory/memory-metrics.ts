import { createAggregatingMetrics } from "../../aggregating-metrics";
import type { MetricSeries } from "../../metric-aggregator";
import type { Metrics } from "../../ports";

/** Metrics that keep every flushed series in memory. */
export interface MemoryMetrics extends Metrics {
  /** Series exported by `flush()`, in order. */
  readonly exported: readonly MetricSeries[];
}

/**
 * Metrics for tests: assert on `exported` (OpenTelemetry-shaped series: name, attributes,
 * sum, count, buckets) after the code under test flushed, instead of spying on a binding.
 */
export function createMemoryMetrics(): MemoryMetrics {
  const exported: MetricSeries[] = [];
  const metrics = createAggregatingMetrics({
    export: (series) => exported.push(...series),
    maxSeriesPerFlush: Number.POSITIVE_INFINITY,
  });
  return { ...metrics, exported };
}
