import type {
  MetricAttributes,
  MetricName,
  MetricNameOf,
} from "../metric-catalog";

/** OpenTelemetry Counter: a monotonic sum. `value` must be non-negative. */
export interface Counter<N extends MetricName> {
  add(value: number, attributes?: MetricAttributes<N>): void;
}

/** OpenTelemetry UpDownCounter: a sum that may go down (items in flight, queue depth). */
export interface UpDownCounter<N extends MetricName> {
  add(value: number, attributes?: MetricAttributes<N>): void;
}

/** OpenTelemetry Histogram: a distribution (durations in seconds, sizes in bytes). */
export interface Histogram<N extends MetricName> {
  record(value: number, attributes?: MetricAttributes<N>): void;
}

/**
 * Port: metrics in the shape of the OpenTelemetry metrics API. An instrument is looked up by
 * a name from the metric catalog (`platform/metric-catalog.ts`), which fixes its kind, unit
 * and the attribute keys it may carry. Recording is synchronous and never throws: invalid
 * values (negative counter increments, NaN, Infinity) are ignored and attribute keys the
 * catalog does not list are dropped. Adapters aggregate in memory; `flush()` hands what was
 * aggregated to the backend and is called once at the end of each unit of work (HTTP
 * request, queue batch, cron run). Implementations pass `describeMetricsContract`
 * (metrics.contract.ts).
 */
export interface Metrics {
  counter<N extends MetricNameOf<"counter">>(name: N): Counter<N>;
  upDownCounter<N extends MetricNameOf<"upDownCounter">>(
    name: N
  ): UpDownCounter<N>;
  histogram<N extends MetricNameOf<"histogram">>(name: N): Histogram<N>;
  /** Sends the aggregated measurements to the backend. Never throws, never waits. */
  flush(): void;
}
