/**
 * In-memory aggregation of measurements into series, the way an OpenTelemetry SDK's delta
 * temporality does it between two exports: one series per metric name and attribute set,
 * with the sum, count, min, max and (for histograms) the count per explicit bucket. Pure;
 * shared by the metrics adapters so validation and aggregation behave the same everywhere.
 */
import {
  type MetricAttributeValue,
  type MetricKind,
  type MetricUnit,
  metricDefinition,
} from "./metric-catalog";

/** One aggregated series between two flushes (delta temporality). */
export interface MetricSeries {
  readonly name: string;
  readonly kind: MetricKind;
  readonly unit: MetricUnit;
  /** Attribute values by key, only the keys the catalog lists, in catalog order. */
  readonly attributes: Readonly<Record<string, MetricAttributeValue>>;
  /** Counter and upDownCounter: the sum of the increments; histogram: the sum of values. */
  readonly sum: number;
  /** How many measurements were aggregated. */
  readonly count: number;
  readonly min: number;
  readonly max: number;
  /** Histogram only: the upper bounds (inclusive) of the buckets, ascending. */
  readonly boundaries?: readonly number[];
  /** Histogram only: one count per bucket, `boundaries.length + 1` of them (last: above). */
  readonly bucketCounts?: readonly number[];
}

/** Series kept between flushes at most; more distinct series are dropped and counted. */
export const MAX_PENDING_SERIES = 1000;

export interface MetricAggregator {
  /** Adds one measurement. Ignores unknown names, wrong kinds and invalid values. */
  record(
    name: string,
    kind: MetricKind,
    value: number,
    attributes?: Readonly<Record<string, unknown>>
  ): void;
  /** Removes and returns at most `limit` series, oldest first; the rest stay for later. */
  drain(limit: number): MetricSeries[];
  /** Series waiting to be drained. */
  readonly pending: number;
  /** Measurements dropped because MAX_PENDING_SERIES was reached (since creation). */
  readonly dropped: number;
}

interface MutableSeries {
  name: string;
  kind: MetricKind;
  unit: MetricUnit;
  attributes: Record<string, MetricAttributeValue>;
  sum: number;
  count: number;
  min: number;
  max: number;
  boundaries?: readonly number[];
  bucketCounts?: number[];
}

function isAttributeValue(value: unknown): value is MetricAttributeValue {
  return (
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

/** The index of the bucket a value falls in: the first bound it does not exceed. */
export function bucketIndex(
  boundaries: readonly number[],
  value: number
): number {
  const index = boundaries.findIndex((bound) => value <= bound);
  return index === -1 ? boundaries.length : index;
}

export function createMetricAggregator(): MetricAggregator {
  const series = new Map<string, MutableSeries>();
  let dropped = 0;

  return {
    record(name, kind, value, attributes = {}) {
      try {
        const definition = metricDefinition(name);
        if (!definition || definition.kind !== kind) return;
        if (typeof value !== "number" || !Number.isFinite(value)) return;
        if (kind === "counter" && value < 0) return;

        const kept: Record<string, MetricAttributeValue> = {};
        for (const key of definition.attributes) {
          const candidate = attributes[key];
          if (isAttributeValue(candidate)) kept[key] = candidate;
        }
        const key = `${name}\u0000${JSON.stringify(
          definition.attributes.map((attribute) => kept[attribute] ?? null)
        )}`;

        let current = series.get(key);
        if (!current) {
          if (series.size >= MAX_PENDING_SERIES) {
            dropped += 1;
            return;
          }
          current = {
            name,
            kind,
            unit: definition.unit,
            attributes: kept,
            sum: 0,
            count: 0,
            min: value,
            max: value,
            ...(kind === "histogram"
              ? {
                  boundaries: definition.buckets ?? [],
                  bucketCounts: new Array(
                    (definition.buckets ?? []).length + 1
                  ).fill(0),
                }
              : {}),
          };
          series.set(key, current);
        }
        current.sum += value;
        current.count += 1;
        current.min = Math.min(current.min, value);
        current.max = Math.max(current.max, value);
        if (current.bucketCounts && current.boundaries) {
          const index = bucketIndex(current.boundaries, value);
          current.bucketCounts[index] = (current.bucketCounts[index] ?? 0) + 1;
        }
      } catch {
        // Metrics never fail the work they measure.
      }
    },
    drain(limit) {
      const out: MetricSeries[] = [];
      for (const [key, value] of series) {
        if (out.length >= limit) break;
        out.push(value);
        series.delete(key);
      }
      return out;
    },
    get pending() {
      return series.size;
    },
    get dropped() {
      return dropped;
    },
  };
}
