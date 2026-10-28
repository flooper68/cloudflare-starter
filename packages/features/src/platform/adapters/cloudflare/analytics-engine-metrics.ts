import { createAggregatingMetrics } from "../../aggregating-metrics";
import type { LogResource } from "../../log-record";
import type { MetricSeries } from "../../metric-aggregator";
import {
  MAX_METRIC_ATTRIBUTES,
  type MetricKind,
  type MetricUnit,
  metricDefinition,
} from "../../metric-catalog";
import type { Metrics } from "../../ports";

/**
 * The data-point layout in the Analytics Engine dataset (one row per series per flush).
 * Queries depend on it: change it only together with the guide's queries
 * (docs/guides/how-to-setup-metrics-and-tracing.md#data-point-layout).
 *
 * - index1: the metric name (the sampling key: Analytics Engine samples per index)
 * - blob1…blob15: the attribute values in catalog order ("" when absent)
 * - blob16: kind, blob17: unit, blob18: service.name, blob19: deployment.environment.name,
 *   blob20: service.version
 * - double1: sum, double2: count, double3: min, double4: max,
 *   double5…double20: histogram bucket counts (bucket i ≤ boundary i, the last above all)
 */
export const ANALYTICS_ENGINE_LAYOUT = {
  attributeBlobs: MAX_METRIC_ATTRIBUTES,
  blob: {
    kind: 16,
    unit: 17,
    serviceName: 18,
    environment: 19,
    serviceVersion: 20,
  },
  double: { sum: 1, count: 2, min: 3, max: 4, firstBucket: 5 },
} as const;

/**
 * Data points written per flush at most. Analytics Engine accepts 250 per invocation; the
 * rest stays aggregated for the next flush, leaving room for other writers.
 */
export const MAX_POINTS_PER_FLUSH = 200;

/** Longest attribute blob, in characters; catalog attributes are short by design. */
const MAX_BLOB_CHARS = 256;

/** The data point of one series, in ANALYTICS_ENGINE_LAYOUT. */
export function toDataPoint(
  series: MetricSeries,
  resource: LogResource
): AnalyticsEngineDataPoint {
  const keys = metricDefinition(series.name)?.attributes ?? [];
  const blobs: string[] = [];
  for (let i = 0; i < ANALYTICS_ENGINE_LAYOUT.attributeBlobs; i += 1) {
    const key = keys[i];
    const value = key === undefined ? undefined : series.attributes[key];
    blobs.push(
      value === undefined ? "" : String(value).slice(0, MAX_BLOB_CHARS)
    );
  }
  blobs.push(
    series.kind,
    series.unit,
    resource["service.name"],
    resource["deployment.environment.name"],
    resource["service.version"]
  );
  return {
    indexes: [series.name],
    blobs,
    doubles: [
      series.sum,
      series.count,
      series.min,
      series.max,
      ...(series.bucketCounts ?? []),
    ],
  };
}

/** A data point read back into a series (tests, and the guide's layout example). */
export function fromDataPoint(point: AnalyticsEngineDataPoint): MetricSeries & {
  readonly resource: LogResource;
} {
  const name = String(point.indexes?.[0] ?? "");
  const blobs = (point.blobs ?? []).map((blob) => String(blob ?? ""));
  const doubles = point.doubles ?? [];
  const definition = metricDefinition(name);
  const attributes: Record<string, string> = {};
  for (const [i, key] of (definition?.attributes ?? []).entries()) {
    const value = blobs[i];
    if (value) attributes[key] = value;
  }
  const blob = (position: number) => blobs[position - 1] ?? "";
  const double = (position: number) => doubles[position - 1] ?? 0;
  const { double: d, blob: b } = ANALYTICS_ENGINE_LAYOUT;
  const boundaries = definition?.buckets;
  return {
    name,
    kind: blob(b.kind) as MetricKind,
    unit: blob(b.unit) as MetricUnit,
    attributes,
    sum: double(d.sum),
    count: double(d.count),
    min: double(d.min),
    max: double(d.max),
    ...(boundaries
      ? {
          boundaries,
          bucketCounts: doubles.slice(
            d.firstBucket - 1,
            d.firstBucket - 1 + boundaries.length + 1
          ),
        }
      : {}),
    resource: {
      "service.name": blob(b.serviceName),
      "deployment.environment.name": blob(b.environment),
      "service.version": blob(b.serviceVersion),
    },
  };
}

export interface AnalyticsEngineMetricsOptions {
  /** The Analytics Engine dataset binding (`METRICS_DATASET` in wrangler.jsonc). */
  readonly dataset: AnalyticsEngineDataset;
  readonly resource: LogResource;
}

/**
 * Metrics adapter for Workers Analytics Engine: measurements are aggregated in memory and
 * each `flush()` writes one data point per series (ANALYTICS_ENGINE_LAYOUT), at most
 * MAX_POINTS_PER_FLUSH. `writeDataPoint` does not block; the runtime sends the points in
 * the background. Query them with the SQL API or from Grafana (see the guide).
 */
export function createAnalyticsEngineMetrics(
  options: AnalyticsEngineMetricsOptions
): Metrics {
  return createAggregatingMetrics({
    maxSeriesPerFlush: MAX_POINTS_PER_FLUSH,
    export: (series) => {
      for (const one of series) {
        try {
          options.dataset.writeDataPoint(toDataPoint(one, options.resource));
        } catch {
          // A rejected point (limits, an unavailable binding) never fails the request.
        }
      }
    },
  });
}
