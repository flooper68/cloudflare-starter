# How to set up logging

Where the web Worker's logs go, what a log record looks like (the OpenTelemetry Logs Data Model), how W3C Trace Context ties a request's records together, how to read them locally and deployed, and how to forward them to an OpenTelemetry backend or write an adapter for another vendor. Use when you choose or change `LOG_SINK`, add log lines, look up a request's logs by its reference, or connect Grafana, Honeycomb, Datadog or another backend.

## What is logged

Server code never calls `console` (GritQL rule `lint/rules/no-console.grit`). It logs through the **Logger** port (`packages/features/src/platform/ports/logger.ts`):

```ts
ctx.logger.info("files.uploaded", { "app.file.size_bytes": size }); // in a tRPC procedure
loggerFor(platform, context).info("cron.completed", {
  "app.cron.name": name,
}); // queue, cron
```

- The first argument is the event name: the record's `body`, a stable dotted name to filter on (`greetings.hello`, `job.completed`, `job.skipped`, `job.retry`, `cron.completed`, `error.captured`, `mcp.error`, `auth.mail_not_sent`).
- The fields are the record's `attributes`. Use [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/) where one exists (`http.request.method`, `url.path`, `http.route`, `http.response.status_code`, `user.id`, `messaging.message.id`, `rpc.method`) and a namespaced `app.*` key otherwise (`app.job.attempts`, `app.workspace.id`). An Error under the key `error` becomes `exception.type`, `exception.message` and `exception.stacktrace`.
- `withContext(context)` binds the unit of work (`loggerFor` and `ctx.logger` do it for you); `child(fields)` adds attributes to every record. Neither changes its parent.
- Every adapter builds records with `toLogRecord` (`platform/log-record.ts`): values under secret-looking keys (`password`, `secret`, `token`, `authorization`, `cookie`, `apiKey`, …) become `[redacted]`, circular references `[circular]`, long strings are cut, and logging never throws. The IP address is never logged, and the `url.path` of HTTP records has token segments (reset-password, verify-email, invite and invitation links) and secret query values replaced by `[redacted]` (`apps/web/src/lib/redact-url.ts`).

## The record

One JSON object per record, the [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/) with snake_case field names:

```json
{
  "timestamp": "2026-10-28T13:21:03.443Z",
  "severity_text": "INFO",
  "severity_number": 9,
  "body": "greetings.hello",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id": "b7ad6b7169203331",
  "trace_flags": "01",
  "attributes": {
    "app.request.source": "queue",
    "user.id": "EOO5KpXKR3pPeBJFpUnD3JZJK0N1TOQg",
    "messaging.system": "cloudflare_queues",
    "messaging.message.id": "434fed3276b80cce8f59d51de4d8b545",
    "app.job.attempts": 1,
    "cloudevents.event_id": "6860a9e4-3734-44f1-b004-bceb5d5565da",
    "cloudevents.event_type": "greetings.hello",
    "cloudevents.event_source": "/production/http",
    "app.greeting.message": "Hello, Barbara"
  },
  "resource": {
    "service.name": "cloudflare-starter-web",
    "service.version": "9034879f-e8f5-4b2e-8ae0-db7db2563cfa",
    "deployment.environment.name": "production"
  }
}
```

Severity numbers: DEBUG 5, INFO 9, WARN 13, ERROR 17. `service.version` is the deployed version id from the `CF_VERSION_METADATA` binding (`local` without it); `deployment.environment.name` is `APP_ENV` (required, no default: `local` in `.dev.vars`, `develop`, `staging`, `production` in `wrangler.jsonc`); `service.name` is `SERVICE_NAME` in `apps/web/src/server/platform.ts` (keep it equal to `name` in `wrangler.jsonc`).

## Trace context

Every unit of work is a span of a [W3C Trace Context](https://www.w3.org/TR/trace-context/) trace (`apps/web/src/server/http.ts`, `packages/features/src/platform/trace-context.ts`):

- **HTTP.** `apps/web/src/middleware.ts` builds the context for every on-demand request. A valid incoming `traceparent` header is continued (same `trace_id`, its span as parent, and only the sampled bit of its flags); otherwise a new trace starts. This holds even when a setting is missing and the request fails with the configuration error. The request always gets its own span id. The incoming trace id is for correlation only and is never trusted for anything else: any client can send one. `x-request-id` from the client is ignored.
- **Responses** carry `traceparent` (our span) and `x-request-id` (the trace id, for people). The trace id is the **reference** users quote; there is no separate request id.
- **Jobs** carry the producer's `traceparent` in their envelope; the consumer continues that trace with a new span per delivery ([how-to-add-background-jobs.md](how-to-add-background-jobs.md)).
- **Cron** entries start a new trace each; the jobs they enqueue continue it.
- `cf-ray` is recorded as `app.cloudflare.ray_id` on error reports from the HTTP edge and the file routes.

```bash
curl -si http://localhost:4321/api/hello | grep -iE 'traceparent|x-request-id'
```

Each request, procedure call, MCP tool call, queue message and cron run is also a span on this trace: with `TRACING=workers` a span record (body `trace.span`) lands in Workers Logs next to the logs, with the same `trace_id`. Workers' automatic traces (`observability.traces`) are created by the runtime with their own ids and are not linked to the starter's trace ids. Spans, metrics and how the two kinds of traces relate: [how-to-setup-metrics-and-tracing.md](how-to-setup-metrics-and-tracing.md).

## LOG_SINK

A required var in every environment of `apps/web/wrangler.jsonc`, with no default. `apps/web/src/server/platform.ts` picks the adapter:

| Value          | Adapter                                                     | Use                                                               |
| -------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| `workers-logs` | `createWorkersLogsLogger` (`platform/adapters/cloudflare/`) | Default in the starter: one record per console call, as an object |
| `none`         | `noopLogger`                                                | Silence (error reports are set separately)                        |

A missing or unknown value fails every request with a 500 whose body names the setting (`LOG_SINK is not set: …`); the queue and cron handlers throw the same error. `bun run doctor` checks each environment and any `.dev.vars` override.

To override locally, add `LOG_SINK=none` to `apps/web/.dev.vars`. Never leave the line blank: a blank value unsets the var.

## Reading logs

**Locally** (`bun run dev:web`): workerd prints each record object in the dev server output.

**Deployed**: Workers Logs, declared in every environment of `wrangler.jsonc`:

```jsonc
"observability": {
  "enabled": true,
  "logs": { "enabled": true, "invocation_logs": true },
  "traces": { "enabled": true }
}
```

In the Cloudflare dashboard, open Workers & Pages → the Worker → Observability, and filter on a field of the record, for example `trace_id = <the reference a user sent>`, `body = error.captured` or `attributes.user.id = <id>`. `bunx wrangler tail` (in `apps/web`, `--env staging` for other environments) streams the same records live. Invocation logs add one line per request with method, URL and status. Workers Logs has a daily volume and a retention limit per plan; lower `head_sampling_rate` under `observability.logs` if a busy Worker goes over it.

## Forwarding to an OpenTelemetry backend

Workers can export logs and traces over OTLP to any OpenTelemetry backend (Grafana Cloud, Honeycomb, Axiom, a collector) without code changes: create a destination with the backend's OTLP endpoint and headers in the dashboard (Workers & Pages → Observability → Destinations), then name it per environment in `wrangler.jsonc`:

```jsonc
"observability": {
  "enabled": true,
  "logs": { "enabled": true, "invocation_logs": true, "destinations": ["grafana-logs"] },
  "traces": { "enabled": true, "destinations": ["grafana-traces"] }
}
```

Our fields (`trace_id`, `span_id`, `severity_text`, `attributes`, `resource`) are in the logged object, which the export carries as the log record's body and attributes. How they map onto the exported OTLP record (for example whether `trace_id` becomes the record's trace id, or `resource` its resource) depends on Cloudflare's export format and on the backend, and it has not been verified against a real destination yet: check it on the first one you set up, and add a mapping step in the backend (or a collector) if it does not group by trace and service on its own. Destinations are account resources: creating one is a change to the owner's Cloudflare account (ask first); keep `observability` identical across environments (`test/architecture/wrangler.test.ts`).

## Another log backend (adapter sketch, not shipped)

When a backend needs its own API rather than OTLP export, write an adapter. It implements the port in its own folder; nothing else imports the SDK (dependency-cruiser `vendor-sdks-only-in-adapters`). `createRecordLogger` (`platform/record-logger.ts`) gives you the same records, child and context semantics as the built-in adapters; you supply where records go. Example: Datadog's HTTP intake, sent with `waitUntil` so the response never waits.

```ts
// packages/features/src/platform/adapters/datadog/datadog-logger.ts
import type { LogResource } from "../../log-record";
import type { Logger } from "../../ports";
import { createRecordLogger } from "../../record-logger";
import { systemClock } from "../../clock";

export function createDatadogLogger(options: {
  readonly apiKey: string; // a Worker secret, never a var
  readonly resource: LogResource;
  readonly waitUntil: (promise: Promise<unknown>) => void;
}): Logger {
  return createRecordLogger({
    resource: options.resource,
    clock: systemClock,
    write: (record) =>
      options.waitUntil(
        fetch("https://http-intake.logs.datadoghq.eu/api/v2/logs", {
          method: "POST",
          headers: {
            "DD-API-KEY": options.apiKey,
            "content-type": "application/json",
          },
          body: JSON.stringify([
            {
              ...record,
              service: record.resource["service.name"],
              status: record.severity_text,
            },
          ]),
        }).catch(() => {}) // a log backend outage must not fail the request
      ),
  });
}
```

Then:

1. `datadog-logger.contract.test.ts` calling `describeLoggerContract` with a harness that captures the request bodies (stub `fetch`, run the `waitUntil` promises).
2. Add `"datadog"` to `LOG_SINKS` in `apps/web/src/lib/config.ts` and a branch in `buildPlatform`. The adapter needs `waitUntil`, so build it per request (from the execution context) rather than per isolate.
3. The API key as a secret: `.dev.vars.example`, `scripts/setup-secrets.ts`, [how-to-setup-ci.md](how-to-setup-ci.md) if the deploy needs it.
4. Set `LOG_SINK` in each environment of `wrangler.jsonc`; keep `observability` on for invocation logs and traces.

Errors go through their own port: [how-to-setup-error-reporting.md](how-to-setup-error-reporting.md); metrics and spans through theirs: [how-to-setup-metrics-and-tracing.md](how-to-setup-metrics-and-tracing.md). The rules for ports and adapters and the standards they follow: [architecture/overview.md](../architecture/overview.md#ports-and-adapters).
