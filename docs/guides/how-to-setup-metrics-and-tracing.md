# How to set up metrics and tracing

::reviewed{date="2026-11-09"}

Every request, procedure, job and schedule is timed and traced at the edge, once per unit of work: latency goes to Workers Analytics Engine, spans to Workers Logs, all under the request's trace id. Use this guide to switch them, add a metric or a span, or query latency and error rates.

::flow[Request or job -> Span and duration -> Analytics Engine and Workers Logs -> SQL or Grafana]{title="Metrics and traces: each unit of work records a span and a duration, which you query with SQL or Grafana"}

## Switch them

:::settings
- METRICS = analytics-engine (analytics-engine | none) Data points in the METRICS_DATASET dataset
- TRACING = workers (workers | none) One span record per span in Workers Logs
  :::

Both are required in every environment of `apps/web/wrangler.jsonc`. Locally, add `METRICS=none` or `TRACING=none` to `apps/web/.dev.vars` to turn one off; never leave the line blank.

## Add a metric or a span

:::steps
1. **Declare the metric** in `METRIC_CATALOG` (`packages/features/src/platform/metric-catalog.ts`), named by OpenTelemetry conventions.
2. **Record it at an edge**, not in a use case: `platform.metrics.histogram("app.cron.run.duration").record(seconds, attributes)`.
3. **A span inside a procedure** (rarely needed, the procedure has one): `ctx.tracer.startActiveSpan("files.thumbnail", attributes, fn)`.
   :::

:::prompt{title="Paste this into your coding agent"}
```text
Add a metric app.<thing>.duration for <work>: declare it in METRIC_CATALOG, record it at
the edge that runs the work, and add a test with createMemoryMetrics. Follow
docs/guides/how-to-setup-metrics-and-tracing.md.
```
:::

## Query it

:::byhand{title="Query latency with SQL"}
The SQL API needs an API token with Account Analytics Read (a change to your account). Weight every sum by `_sample_interval`: requests are `SUM(_sample_interval * double2)`, the average is the weighted `double1` over the weighted `double2`. A full query and the Grafana set-up: [querying](../reference/metrics-and-tracing.md#querying).
:::

:::decision{title="No gauges, no /metrics endpoint"}
A Worker runs in many short-lived isolates, so a "last value" means nothing and there is no process to scrape. Counters and histograms are pushed per unit of work.
:::

## Reference

What is measured at each edge, the metric catalog and naming, the data-point layout, Prometheus and Grafana, and span records: [Metrics and tracing reference](../reference/metrics-and-tracing.md).
