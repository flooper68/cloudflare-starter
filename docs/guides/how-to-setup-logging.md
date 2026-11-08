# How to set up logging

::reviewed{date="2026-11-09"}

Every request, job and schedule logs structured records (the OpenTelemetry log shape) under one trace id, so a person's error reference finds everything that happened. Use this guide to choose where logs go, add a log line, or find a request's logs.

::flow[Request or job -> Logger port -> Workers Logs -> Filter by trace_id]{title="Logs: code logs through the logger port, records go to Workers Logs, you filter them by trace id"}

## Choose where logs go

:::settings
- LOG_SINK = workers-logs (workers-logs | none) One record per log call in Workers Logs, or silence
  :::

Required in every environment of `apps/web/wrangler.jsonc`. Locally, add `LOG_SINK=none` to `apps/web/.dev.vars` to silence it; never leave the line blank.

## Add a log line

Server code never calls `console`; it logs through the port, with a stable dotted event name and namespaced attributes:

```ts
ctx.logger.info("files.uploaded", { "app.file.size_bytes": size });
```

:::gotcha{title="Secrets are redacted by key, IPs never logged"}
Values under keys like `password`, `token` or `cookie` become `[redacted]`, and token segments in URLs are removed. Still, never put a secret in a log line.
:::

## Find a request's logs

:::steps
1. **Take the reference** a person quotes from an error: it is the trace id.
2. **Open Workers Logs**: Cloudflare dashboard › Workers & Pages › the Worker › Observability.
3. **Filter** on `trace_id = <reference>`; follow-up jobs share it.
   :::

:::byhand{title="From a terminal"}
`cd apps/web && bunx wrangler tail --env production` streams live records. Locally the dev server prints them.
:::

:::decision{title="One trace id end to end"}
W3C Trace Context ties a request to the jobs and schedules it causes, so one search shows the whole story.
:::

## Reference

The record format, trace context, forwarding to an OpenTelemetry backend, and another log backend: [Logging reference](../reference/logging.md).
