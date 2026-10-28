import { createMetricAggregator, type MetricSeries } from "./metric-aggregator";
import type { Metrics } from "./ports";

export interface AggregatingMetricsOptions {
  /** Where flushed series go (an Analytics Engine dataset, a buffer, an OTLP batch). Must not throw. */
  readonly export: (series: readonly MetricSeries[]) => void;
  /** Most series handed to `export` per flush; the rest wait for the next flush. */
  readonly maxSeriesPerFlush: number;
}

/**
 * Metrics that aggregate measurements in memory (metric-aggregator.ts) and hand the series
 * to `export` on `flush()`. Adapters wrap it with their backend, so validation, attribute
 * filtering and aggregation are the same for every adapter.
 */
export function createAggregatingMetrics(
  options: AggregatingMetricsOptions
): Metrics {
  const aggregator = createMetricAggregator();
  return {
    counter: (name) => ({
      add: (value, attributes) =>
        aggregator.record(name, "counter", value, attributes),
    }),
    upDownCounter: (name) => ({
      add: (value, attributes) =>
        aggregator.record(name, "upDownCounter", value, attributes),
    }),
    histogram: (name) => ({
      record: (value, attributes) =>
        aggregator.record(name, "histogram", value, attributes),
    }),
    flush() {
      try {
        const series = aggregator.drain(options.maxSeriesPerFlush);
        if (series.length) options.export(series);
      } catch {
        // A metrics backend failure never fails the work it measured.
      }
    },
  };
}
