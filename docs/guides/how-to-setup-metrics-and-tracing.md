# How to set up metrics and tracing

How the web Worker measures and traces its work: the Metrics and Tracer ports (shaped on the OpenTelemetry API), the metric catalog and its naming rules (OpenTelemetry semantic conventions, OpenMetrics when exported), the built-in instrumentation, where the data goes (Workers Analytics Engine for metrics, span records in Workers Logs for traces), how to query it, and how to reach Prometheus or Grafana. Use when you choose or change `METRICS` or `TRACING`, add a metric or a span, query request latency or error rates, or connect a metrics or tracing backend.

## What is measured

Instrumentation lives at the edges, once per unit of work; use cases are never instrumented themselves.

| Edge                                            | Span (name, kind)                                                                                                                                       | Metric                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP (`apps/web/src/server/http.ts`)            | `{method} {http.route}`, server; the request context's own span                                                                                         | `http.server.request.duration` (s) by `http.request.method`, `http.route`, `http.response.status_code`, `url.scheme`, `error.type` (5xx)                                                                                                                                                                                  |
| tRPC (`apps/web/src/server/trpc/init.ts`)       | `{rpc.method}` (`storage.listFiles`), internal, child of the request span                                                                               | `rpc.server.call.duration` (s) by `rpc.system.name` (`trpc`), `rpc.method`, `error.type` (the tRPC code: `BAD_REQUEST`, `INTERNAL_SERVER_ERROR`, …)                                                                                                                                                                       |
| MCP tools (`apps/web/src/server/mcp/server.ts`) | `tools/call {tool}`, internal, child of the request span; the procedures it calls are its child spans; attributes `mcp.method.name`, `gen_ai.tool.name` | none of its own: the procedures it calls are measured as tRPC calls                                                                                                                                                                                                                                                       |
| Jobs consumer (`apps/web/src/server/queue.ts`)  | `process {queue}`, consumer, one per job message; continues the trace of the work that enqueued it                                                      | `messaging.client.consumed.messages` ({message}) and `messaging.process.duration` (s) by `messaging.system`, `messaging.operation.name`, `messaging.destination.name`, `app.job.type` (only a type from the job catalog), `app.job.outcome` (`completed`, `skipped`, `retry`, `dead_lettered`, `discarded`), `error.type` |
| Cron (`apps/web/src/server/cron.ts`)            | `cron {entry}`, internal, one per cron catalog entry run; a new trace each                                                                              | `app.cron.run.duration` (s) by `app.cron.name`, `app.cron.schedule`, `error.type` (`missing_catalog_entry` for a trigger no entry handles)                                                                                                                                                                                |

A histogram also counts: the request count by route, method and status is its `count`, so there is no separate request counter. Status classes (2xx, 4xx, 5xx) are derived when querying (the first digit of `http.response.status_code`), as the semantic conventions advise; `http.route` is the route template (Astro's `routePattern`, `/api/files/[id]`), never the raw path.

Inside a procedure span, `ctx.logger`, `ctx.tracer` and `ctx.requestContext` are bound to that span, so its log records and error reports carry the procedure's `span_id` and the request's `trace_id`.

## Metric catalog and naming

Every metric is declared once in `METRIC_CATALOG` (`packages/features/src/platform/metric-catalog.ts`) with its OpenTelemetry instrument kind, [UCUM](https://ucum.org/) unit, description, the only attribute keys it may carry (in a fixed order) and, for histograms, its bucket boundaries:

```ts
"rpc.server.call.duration": {
  kind: "histogram",
  unit: "s",
  description: "Duration of a tRPC procedure call (from the web app or an MCP tool).",
  attributes: ["rpc.system.name", "rpc.method", "error.type"],
  buckets: DURATION_BUCKETS_SECONDS, // OpenTelemetry's advised duration buckets
},
```

Rules (checked by `metric-catalog.test.ts` and `test/architecture/metrics.test.ts`):

- **Names** follow the [OpenTelemetry semantic conventions for metrics](https://opentelemetry.io/docs/specs/semconv/general/metrics/) where one exists (`http.server.request.duration`, `rpc.server.call.duration`, `messaging.process.duration`) and `app.<area>.<thing>` otherwise. Lowercase dotted, no unit in the name, no `_total`.
- **Units** are UCUM as OpenTelemetry writes them: `s` (always seconds, never ms), `By`, `1` (a ratio), `{request}`, `{message}`, `{run}`, `{call}`. Durations are histograms in seconds.
- **Attributes** are low-cardinality only: method, route template, status code, error type, outcome, schedule, and names from a catalog in code (job type, cron entry). Never a user, workspace, file or message id, an email, an IP or a raw path; those belong on spans and log records. The catalog test rejects such keys; adapters drop any key the entry does not list; the architecture test fails when code passes one.
- **Every name used in code is in the catalog, and every catalog metric is recorded somewhere.** Code can only name catalog metrics (the port is typed by the catalog), and the architecture test checks names, kinds and attribute keys of every call.

**OpenMetrics names.** When a metric is exported to Prometheus (OpenMetrics), OpenTelemetry's [Prometheus compatibility rules](https://opentelemetry.io/docs/specs/otel/compatibility/prometheus_and_openmetrics/) apply: dots become underscores, the base unit becomes a suffix, counters end in `_total`, and a histogram is three series. `toOpenMetricsName` implements it:

| Catalog name                         | Kind      | OpenMetrics                                                       |
| ------------------------------------ | --------- | ----------------------------------------------------------------- |
| `http.server.request.duration`       | histogram | `http_server_request_duration_seconds_bucket`, `…_sum`, `…_count` |
| `rpc.server.call.duration`           | histogram | `rpc_server_call_duration_seconds_*`                              |
| `messaging.process.duration`         | histogram | `messaging_process_duration_seconds_*`                            |
| `messaging.client.consumed.messages` | counter   | `messaging_client_consumed_messages_total`                        |
| `app.cron.run.duration`              | histogram | `app_cron_run_duration_seconds_*`                                 |

Labels follow the same rule (`http.response.status_code` → `http_response_status_code`).

## Recording a metric or a span

```ts
// A new metric: first add it to METRIC_CATALOG, then record it at an edge.
platform.metrics.histogram("app.cron.run.duration").record(seconds, {
  "app.cron.name": entry.name,
  "app.cron.schedule": controller.cron,
});

// A span around a piece of work inside a procedure (rarely needed: the procedure has one).
await ctx.tracer.startActiveSpan(
  "files.thumbnail",
  { "app.file.kind": kind },
  async (span) => {
    span.setAttribute("app.file.size_bytes", size);
    return makeThumbnail();
  }
);
```

- **Metrics port** (`platform/ports/metrics.ts`): `counter(name).add(value, attributes)`, `upDownCounter(name).add(…)`, `histogram(name).record(value, attributes)`, `flush()`. Recording never throws and never waits; negative counter increments, `NaN` and `Infinity` are ignored. There is no gauge: a Worker runs in many short-lived isolates, so "the last value" of one isolate means nothing; record a histogram or an upDownCounter instead.
- **Tracer port** (`platform/ports/tracer.ts`): `withContext(context)` binds a unit of work; `startActiveSpan(name, attributes, fn)` runs `fn` in a child span (new span id, the bound span as parent, same trace id), ends it when `fn` returns or its promise settles, and on a throw records the exception (`exception` event with `exception.*` attributes), sets the status to error and rethrows. `startContextSpan` does the same for the span the context itself names (the edges use it). The span passed to `fn` has `setAttribute`, `recordException`, `setStatus`, `end` and `context` (bind loggers and child tracers to it).
- Span attributes may carry ids (`user.id` is added from the context); secrets are redacted by key as in log records.
- New edges (another handler type) record their span and metric the same way and call `platform.metrics.flush()` when the unit of work ends.

## METRICS and TRACING

Required vars in every environment of `apps/web/wrangler.jsonc`, with no default, validated in `apps/web/src/lib/config.ts`, chosen in `apps/web/src/server/platform.ts` and checked by `bun run doctor`:

| Setting   | Value              | Adapter                                                          | Effect                                                                                   |
| --------- | ------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `METRICS` | `analytics-engine` | `createAnalyticsEngineMetrics` (`platform/adapters/cloudflare/`) | Data points in the `METRICS_DATASET` Analytics Engine dataset; needs the binding         |
| `METRICS` | `none`             | `noopMetrics`                                                    | Nothing recorded                                                                         |
| `TRACING` | `workers`          | `createWorkersTracer` (`platform/adapters/cloudflare/`)          | One span record per span in Workers Logs                                                 |
| `TRACING` | `none`             | `noopTracer`                                                     | No span records; code still runs in spans with their own span ids, so logs stay distinct |

A missing or unknown value fails every request with a 500 naming the setting (`METRICS is not set: …`); `METRICS=analytics-engine` without the binding fails with an error naming `METRICS_DATASET`. To override locally, add `METRICS=none` or `TRACING=none` to `apps/web/.dev.vars`; never leave the line blank. The setting and the binding have different names because vars and bindings share one namespace in a Worker.

Tests use `createMemoryMetrics` (assert on `exported` after a flush) and `createMemoryTracer` (assert on `spans`), passed in through the `Platform` (queue, cron) or the tRPC context (procedures, MCP tools). The HTTP edge builds its platform from `env`, so its API tests assert on what the configured adapters wrote: span records on the console filtered on `SPAN_EVENT`, and data points on the simulated `METRICS_DATASET` binding decoded with `fromDataPoint` (`apps/web/test/api/observability.test.ts`).

## Metrics in Workers Analytics Engine

The binding, one dataset per environment (created by the first write; no setup command, `setup:cloudflare` lists it):

```jsonc
"analytics_engine_datasets": [
  { "binding": "METRICS_DATASET", "dataset": "cloudflare_starter_production_metrics" }
]
```

**Aggregation and limits.** A Worker invocation may write at most 250 data points, each with one index (at most 96 bytes), 20 blobs and 20 doubles ([limits](https://developers.cloudflare.com/analytics/analytics-engine/limits/)); data is kept three months. The adapter therefore aggregates in memory (one series per metric and attribute set: sum, count, min, max, bucket counts) and writes on `flush()`, which each edge calls once when its unit of work ends: at most 200 points per flush (`MAX_POINTS_PER_FLUSH`), the rest waits for the next flush; more than 1000 distinct pending series (`MAX_PENDING_SERIES`) are dropped. A typical request writes one to three points. Measurements of concurrent requests in the same isolate may go out with whichever request flushes first; sums and counts stay correct because every point is a delta.

### Data-point layout

| Column                | Holds                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index1`              | the metric name (`http.server.request.duration`); also Analytics Engine's sampling key                                                           |
| `blob1` … `blob15`    | the attribute values in the catalog entry's order, `""` when absent (for HTTP: method, route, status code, scheme, error type)                   |
| `blob16`, `blob17`    | instrument kind (`histogram`, `counter`, `upDownCounter`), unit (`s`)                                                                            |
| `blob18` … `blob20`   | `service.name`, `deployment.environment.name`, `service.version` (the deployed version id)                                                       |
| `double1` … `double4` | sum, count, min, max of the measurements in the point                                                                                            |
| `double5` …           | histogram bucket counts: `double5` counts values ≤ the first boundary (0.005 s), `double6` ≤ 0.01 s, …, `double18` ≤ 10 s, `double19` above 10 s |

`ANALYTICS_ENGINE_LAYOUT`, `toDataPoint` and `fromDataPoint` in `analytics-engine-metrics.ts` define it; queries depend on it, so change it only with this section.

### Querying

Analytics Engine samples high-volume indexes ([sampling](https://developers.cloudflare.com/analytics/analytics-engine/sampling/)): every row has a `_sample_interval`, and every sum must be weighted by it. The [SQL API](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/) needs an API token with Account Analytics Read (a change to the owner's account: ask first).

```bash
curl "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/analytics_engine/sql" \
  --header "Authorization: Bearer $API_TOKEN" \
  --data "SELECT blob2 AS route, blob1 AS method,
                 SUM(_sample_interval * double2) AS requests,
                 SUM(_sample_interval * double1) / SUM(_sample_interval * double2) AS avg_seconds,
                 SUM(_sample_interval * (double12 + double13 + double14 + double15
                                         + double16 + double17 + double18 + double19))
                   / SUM(_sample_interval * double2) AS share_over_250ms
          FROM cloudflare_starter_production_metrics
          WHERE index1 = 'http.server.request.duration'
            AND timestamp > NOW() - INTERVAL '1' DAY
          GROUP BY route, method ORDER BY requests DESC"
```

- Requests: `SUM(_sample_interval * double2)`. Server error rate: the same with `AND blob5 != ''` (`error.type` is set only for 5xx) divided by the total; a status class: `AND blob3 >= '400' AND blob3 < '500'`.
- Average: weighted sum of `double1` over weighted sum of `double2`.
- Latency targets: sum the bucket columns. "p95 under 250 ms" holds when the share of requests in the buckets above 0.25 s (`double11` counts ≤ 0.25 s, so `double12`…`double19`) is at most 5 %; for a percentile value, sum each bucket column and interpolate as Prometheus' `histogram_quantile` does.

**Grafana.** Add the Altinity ClickHouse data source (`vertamedia-clickhouse-datasource`) with URL `https://api.cloudflare.com/client/v4/accounts/<account_id>/analytics_engine/sql`, all auth settings off and a custom header `Authorization: Bearer <token>`; set the time column to `timestamp` and use `$timeSeries` and `$timeFilter` in queries ([Cloudflare's Grafana guide](https://developers.cloudflare.com/analytics/analytics-engine/grafana/)). The queries above work as they are.

### Why there is no `/metrics` endpoint

A Prometheus scrape reads one process's counters. A Worker has no such process: each request may land in a different isolate in a different data center, each isolate holds only its own counters, and isolates are created and evicted at any time. A `/metrics` route would return one random isolate's partial numbers. The Worker therefore pushes: aggregated deltas per unit of work to Analytics Engine, which sums them across isolates.

### Getting to Prometheus or Grafana Cloud (OTLP push, adapter sketch, not shipped)

Prometheus 3 (`--web.enable-otlp-receiver`, path `/api/v1/otlp/v1/metrics`), Grafana Mimir and Grafana Cloud accept OTLP metrics. A push adapter reuses the aggregation and sends each flush as an OTLP/HTTP JSON request inside `waitUntil`:

```ts
// packages/features/src/platform/adapters/otlp/otlp-metrics.ts
import { createAggregatingMetrics } from "../../aggregating-metrics";
import type { LogResource } from "../../log-record";
import type { Metrics } from "../../ports";

export function createOtlpMetrics(options: {
  readonly endpoint: string; // e.g. https://otlp-gateway-<zone>.grafana.net/otlp/v1/metrics
  readonly headers: Readonly<Record<string, string>>; // credentials from a Worker secret
  readonly resource: LogResource;
  readonly waitUntil: (promise: Promise<unknown>) => void;
}): Metrics {
  return createAggregatingMetrics({
    maxSeriesPerFlush: 1000,
    export: (series) =>
      options.waitUntil(
        fetch(options.endpoint, {
          method: "POST",
          headers: { ...options.headers, "content-type": "application/json" },
          // toOtlpJson: resourceMetrics → scopeMetrics → metrics, one data point per series,
          // aggregationTemporality DELTA (2), explicitBounds = series.boundaries.
          body: JSON.stringify(toOtlpJson(series, options.resource)),
        }).catch(() => {}) // a metrics outage never fails the request
      ),
  });
}
```

The points are deltas (each isolate only knows what it saw since its last flush). Prometheus stores cumulative series: run Prometheus 3 with the experimental `otlp-deltatocumulative` feature, or put an OpenTelemetry Collector (or Grafana Alloy) with the `deltatocumulative` processor in front of it. Then: the adapter's contract test (`describeMetricsContract`), a value of `METRICS` in `config.ts` and `platform.ts` (built per request, since it needs `waitUntil`), the secrets in `.dev.vars.example` and `setup-secrets.ts`, and the setting in every environment ([Ports and adapters](../architecture/overview.md#ports-and-adapters)).

## Traces

### Span records

Each ended span is one JSON record in Workers Logs, an OpenTelemetry span that is also a valid log record (body `trace.span`, INFO or ERROR):

```json
{
  "timestamp": "2026-10-28T13:21:03.468Z",
  "severity_text": "INFO",
  "severity_number": 9,
  "body": "trace.span",
  "name": "storage.listFiles",
  "kind": "internal",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id": "a3f1c2d4e5b60718",
  "parent_span_id": "b7ad6b7169203331",
  "trace_flags": "01",
  "start_time": "2026-10-28T13:21:03.443Z",
  "end_time": "2026-10-28T13:21:03.468Z",
  "duration_ms": 25,
  "status": { "code": "unset" },
  "attributes": {
    "app.request.source": "http",
    "user.id": "EOO5KpXKR3pPeBJFpUnD3JZJK0N1TOQg",
    "rpc.system.name": "trpc",
    "rpc.method": "storage.listFiles",
    "app.trpc.type": "query"
  },
  "events": [],
  "resource": {
    "service.name": "cloudflare-starter-web",
    "service.version": "9034879f-e8f5-4b2e-8ae0-db7db2563cfa",
    "deployment.environment.name": "production"
  }
}
```

A request's spans share its `trace_id` (the reference users quote and `x-request-id`) with its log records: filter Workers Logs on `trace_id = <reference>` to see both, or on `body = trace.span` and `name` for spans alone. The server span's `span_id` is the one in the response's `traceparent`; an incoming `traceparent` is the server span's parent. Durations come from the Workers clock, which advances only on I/O: CPU-only work inside a span shows as 0 ms. With `observability.logs` exported over OTLP ([how-to-setup-logging.md](how-to-setup-logging.md#forwarding-to-an-opentelemetry-backend)), the records reach the backend as logs; turning them into backend spans needs a mapping step there or in a collector (verify on the first destination).

### Workers automatic tracing

`observability.traces` in `wrangler.jsonc` makes the runtime trace every invocation on its own: the handler (fetch, queue, scheduled), outgoing `fetch` and binding calls (D1, R2, KV, queues), in Workers & Pages → the Worker → Observability → Traces, kept seven days and exportable over OTLP ([Workers traces](https://developers.cloudflare.com/workers/observability/traces/)). These platform spans have the runtime's own trace ids: Cloudflare does not continue an incoming `traceparent`, so they are not linked to the starter's W3C trace. Use them for what the starter does not see (time per D1 query, per subrequest) and the span records for the app's own structure (route, procedure, tool, message, outcome, user). The runtime also offers custom spans (`tracing.enterSpan` from `cloudflare:workers`) that nest inside its trace; the Tracer port could drive them from a later adapter, which would put the app's spans into the platform trace as well.

Rules for ports and adapters: [architecture/overview.md](../architecture/overview.md#ports-and-adapters). Logs: [how-to-setup-logging.md](how-to-setup-logging.md). Using the metrics for performance targets: [architecture/performance.md](../architecture/performance.md#production-observation).
