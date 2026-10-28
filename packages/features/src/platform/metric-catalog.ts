/**
 * The metric catalog: every metric the app records, with its OpenTelemetry instrument kind,
 * UCUM unit, description and the only attribute keys it may carry. Names follow the
 * OpenTelemetry semantic conventions where one exists (`http.server.request.duration`) and
 * `app.*` otherwise; exported names follow OpenMetrics (`toOpenMetricsName`). Code records
 * a metric only by a name from this catalog (typed, and checked by
 * test/architecture/metrics.test.ts). Guide: docs/guides/how-to-setup-metrics-and-tracing.md
 */

/** OpenTelemetry synchronous instruments. A gauge is left out on purpose (see the guide). */
export type MetricKind = "counter" | "upDownCounter" | "histogram";

/**
 * UCUM units as OpenTelemetry writes them: `s` seconds, `By` bytes, `1` a ratio, and
 * annotations in braces for counts of things (`{request}`, `{message}`).
 */
export const METRIC_UNITS = [
  "s",
  "By",
  "1",
  "{request}",
  "{message}",
  "{run}",
  "{call}",
] as const;
export type MetricUnit = (typeof METRIC_UNITS)[number];

/**
 * The bucket boundaries OpenTelemetry advises for duration histograms in seconds
 * (http.server.request.duration, rpc.server.call.duration, messaging.process.duration).
 */
export const DURATION_BUCKETS_SECONDS = [
  0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10,
] as const;

export interface MetricDefinition {
  readonly kind: MetricKind;
  readonly unit: MetricUnit;
  readonly description: string;
  /**
   * The attribute keys a measurement may carry, in a fixed order (the Analytics Engine
   * adapter stores their values as blob1, blob2, … in this order). Low cardinality only:
   * never a user, workspace, file or request id.
   */
  readonly attributes: readonly string[];
  /** Explicit bucket boundaries of a histogram, ascending; at most 15. */
  readonly buckets?: readonly number[];
}

/** The catalog. Add a metric here before recording it; remove it when nothing records it. */
export const METRIC_CATALOG = {
  "http.server.request.duration": {
    kind: "histogram",
    unit: "s",
    description:
      "Duration of HTTP server requests, until the response headers are ready.",
    attributes: [
      "http.request.method",
      "http.route",
      "http.response.status_code",
      "url.scheme",
      "error.type",
    ],
    buckets: DURATION_BUCKETS_SECONDS,
  },
  "rpc.server.call.duration": {
    kind: "histogram",
    unit: "s",
    description:
      "Duration of a tRPC procedure call (from the web app or an MCP tool).",
    attributes: ["rpc.system.name", "rpc.method", "error.type"],
    buckets: DURATION_BUCKETS_SECONDS,
  },
  "messaging.process.duration": {
    kind: "histogram",
    unit: "s",
    description:
      "Duration of processing one job message, by job type (from the job catalog) and outcome.",
    attributes: [
      "messaging.system",
      "messaging.operation.name",
      "messaging.destination.name",
      "app.job.type",
      "app.job.outcome",
      "error.type",
    ],
    buckets: DURATION_BUCKETS_SECONDS,
  },
  "messaging.client.consumed.messages": {
    kind: "counter",
    unit: "{message}",
    description: "Queue messages delivered to the consumer, valid or not.",
    attributes: [
      "messaging.system",
      "messaging.operation.name",
      "messaging.destination.name",
    ],
  },
  "app.cron.run.duration": {
    kind: "histogram",
    unit: "s",
    description:
      "Duration of one cron catalog entry's run, by entry, schedule and outcome.",
    attributes: ["app.cron.name", "app.cron.schedule", "error.type"],
    buckets: DURATION_BUCKETS_SECONDS,
  },
} as const satisfies Readonly<Record<string, MetricDefinition>>;

export type MetricCatalog = typeof METRIC_CATALOG;
export type MetricName = keyof MetricCatalog;
export type MetricNameOf<K extends MetricKind> = {
  [N in MetricName]: MetricCatalog[N]["kind"] extends K ? N : never;
}[MetricName];

/** An attribute value: OpenTelemetry primitives. */
export type MetricAttributeValue = string | number | boolean;

/** The attributes a metric may carry: only the keys its catalog entry lists. */
export type MetricAttributes<N extends MetricName> = Readonly<
  Partial<Record<MetricCatalog[N]["attributes"][number], MetricAttributeValue>>
>;

export function metricDefinition(name: string): MetricDefinition | undefined {
  return Object.hasOwn(METRIC_CATALOG, name)
    ? (METRIC_CATALOG as Readonly<Record<string, MetricDefinition>>)[name]
    : undefined;
}

/** Most attribute keys per metric: the Analytics Engine layout has 15 attribute blobs. */
export const MAX_METRIC_ATTRIBUTES = 15;
/** Most bucket boundaries per histogram: 16 bucket counts fit the Analytics Engine doubles. */
export const MAX_HISTOGRAM_BOUNDARIES = 15;
/** Analytics Engine stores the name as the index, which is at most 96 bytes. */
export const MAX_METRIC_NAME_BYTES = 96;

/** OpenTelemetry instrument names: lowercase dotted segments of [a-z0-9_]. */
const METRIC_NAME = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
/** Attribute keys: semantic-convention keys or `app.*`, the same shape as names. */
const ATTRIBUTE_KEY = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
/**
 * Keys that identify a person, tenant or single record. Metric attributes multiply the
 * number of series by every distinct value; ids belong on log records and spans instead.
 */
const HIGH_CARDINALITY_KEY =
  /\.(id|ids|uuid|email|ip|token)$|^(user|session|client|enduser)\.|^app\.workspace\.|^url\.(path|full|query)$/;

/** Why a catalog entry is invalid, or an empty list. Checked by the catalog unit test. */
export function validateMetricDefinition(
  name: string,
  definition: MetricDefinition
): string[] {
  const problems: string[] = [];
  if (!METRIC_NAME.test(name))
    problems.push(`name "${name}" is not a dotted lowercase OTel name`);
  if (new TextEncoder().encode(name).byteLength > MAX_METRIC_NAME_BYTES)
    problems.push(
      `name "${name}" is longer than ${MAX_METRIC_NAME_BYTES} bytes`
    );
  if (!(METRIC_UNITS as readonly string[]).includes(definition.unit))
    problems.push(`unit "${definition.unit}" is not one of ${METRIC_UNITS}`);
  if (definition.unit === "1" && definition.kind !== "upDownCounter")
    problems.push("unit 1 (a ratio) only fits an upDownCounter");
  if (!definition.description.trim()) problems.push("description is empty");
  if (definition.attributes.length > MAX_METRIC_ATTRIBUTES)
    problems.push(`more than ${MAX_METRIC_ATTRIBUTES} attributes`);
  if (new Set(definition.attributes).size !== definition.attributes.length)
    problems.push("attribute keys repeat");
  for (const key of definition.attributes) {
    if (!ATTRIBUTE_KEY.test(key))
      problems.push(`attribute "${key}" is not a dotted lowercase key`);
    if (HIGH_CARDINALITY_KEY.test(key))
      problems.push(
        `attribute "${key}" identifies a person or record: put it on logs or spans, not metrics`
      );
  }
  if (definition.kind === "histogram") {
    const buckets = definition.buckets ?? [];
    if (buckets.length === 0) problems.push("histogram without buckets");
    if (buckets.length > MAX_HISTOGRAM_BOUNDARIES)
      problems.push(`more than ${MAX_HISTOGRAM_BOUNDARIES} bucket boundaries`);
    if (buckets.some((bound, i) => i > 0 && bound <= (buckets[i - 1] ?? 0)))
      problems.push("bucket boundaries are not strictly ascending");
  } else if (definition.buckets) {
    problems.push("only histograms have buckets");
  }
  if (definition.kind === "counter" && name.endsWith("_total"))
    problems.push("do not end a name in _total: the exporter adds it");
  return problems;
}

/** OpenMetrics unit suffixes for UCUM units (annotations in braces have none). */
const OPENMETRICS_UNIT: Readonly<Record<MetricUnit, string>> = {
  s: "seconds",
  By: "bytes",
  "1": "ratio",
  "{request}": "",
  "{message}": "",
  "{run}": "",
  "{call}": "",
};

/**
 * The OpenMetrics (Prometheus) name of a catalog metric, as OpenTelemetry's Prometheus
 * exporters write it: dots become underscores, the base unit is appended (`_seconds`,
 * `_bytes`, `_ratio`) and counters end in `_total`. A histogram is exported as
 * `<name>_bucket`, `<name>_sum` and `<name>_count`.
 */
export function toOpenMetricsName(name: MetricName | string): string {
  const definition = metricDefinition(name);
  if (!definition) throw new Error(`Unknown metric ${name}`);
  const base = name.replace(/[^a-zA-Z0-9_]/g, "_");
  const unit = OPENMETRICS_UNIT[definition.unit];
  const withUnit =
    unit && !base.endsWith(`_${unit}`) ? `${base}_${unit}` : base;
  return definition.kind === "counter" ? `${withUnit}_total` : withUnit;
}

/** An attribute key in OpenMetrics label form: `http.route` → `http_route`. */
export function toOpenMetricsLabel(key: string): string {
  return key.replace(/[^a-zA-Z0-9_]/g, "_");
}
