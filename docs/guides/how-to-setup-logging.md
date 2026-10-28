# How to set up logging

Where the web Worker's logs go, how to read them locally and deployed, how a request id ties them together, and how to send them to another vendor by writing an adapter. Use when you choose or change `LOG_SINK`, look for a request's logs, add log lines to code, or connect Datadog, OpenTelemetry or another log backend.

## What is logged

Server code never calls `console` (GritQL rule `lint/rules/no-console.grit`). It logs through the **Logger** port (`packages/features/src/platform/ports/logger.ts`):

```ts
ctx.logger.info("files.uploaded", { fileId, sizeBytes }); // in a tRPC procedure
loggerFor(platform, context).warn("queue.invalid", { issues }); // in the queue or cron handler
```

- `event` is a stable dotted name to filter on (`queue.hello`, `cron.hello`, `error.captured`, `mcp.error`, `auth.mail_not_sent`); details go in the fields.
- Every line written through `ctx.logger` or `loggerFor(platform, context)` carries the request context: `requestId`, `source` (`http`, `queue`, `cron`), `userId`, `workspaceId`, `release` (the deployed version id from the `CF_VERSION_METADATA` binding, `local` without it) and `environment` (`APP_ENV`). The IP is not logged. The exception is `auth.mail_not_sent` (Better Auth callbacks get no request context), which has only its own fields; it carries the auth link only when `APP_ENV=local` ([how-to-setup-auth.md](how-to-setup-auth.md)).
- `child(fields)` returns a logger that adds fields to each line and never changes its parent.
- Fields are made safe by `toLogRecord` (`platform/log-record.ts`) in every adapter: values under secret-looking keys (`password`, `secret`, `token`, `authorization`, `cookie`, `apiKey`, …) become `[redacted]`, errors become `{ name, message, stack, cause }`, circular references `[circular]`, and long strings are cut. Logging never throws.

## Request ids

`apps/web/src/middleware.ts` builds a request context for every on-demand request (`apps/web/src/server/app-middleware.ts` and `http.ts`). The id is generated on the server; an incoming `x-request-id` header is ignored. Every response carries it as `x-request-id`, a queued message carries it so the consumer's lines share it, and an unexpected failure returns it as `reference`. `cf-ray` (Cloudflare's own request id) is recorded as `cfRay` on error reports from the HTTP edge and the file routes; Workers Logs groups the other lines of an invocation with its invocation log.

```bash
curl -si http://localhost:4321/api/hello | grep -i x-request-id
```

## LOG_SINK

A required var in every environment of `apps/web/wrangler.jsonc`, with no default. `apps/web/src/server/platform.ts` picks the adapter:

| Value          | Adapter                                                     | Use                                                    |
| -------------- | ----------------------------------------------------------- | ------------------------------------------------------ |
| `workers-logs` | `createWorkersLogsLogger` (`platform/adapters/cloudflare/`) | Default in the starter: one structured object per line |
| `none`         | `noopLogger`                                                | Silence (error reports are set separately)             |

A missing or unknown value fails every request with a 500 whose body names the setting (`LOG_SINK is not set: …`); the queue and cron handlers throw the same error. `bun run doctor` checks each environment and any `.dev.vars` override.

To override locally, add `LOG_SINK=none` to `apps/web/.dev.vars`. Never leave the line blank: a blank value unsets the var.

## Reading logs

**Locally** (`bun run dev:web`): workerd prints each logged object in the dev server output.

**Deployed**: Workers Logs, declared in every environment of `wrangler.jsonc`:

```jsonc
"observability": {
  "enabled": true,
  "logs": { "enabled": true, "invocation_logs": true },
  "traces": { "enabled": true }
}
```

In the Cloudflare dashboard, open Workers & Pages → the Worker → Observability, and filter on a field, for example `requestId = <the reference a user sent>` or `event = error.captured`. `bunx wrangler tail` (in `apps/web`, `--env staging` for other environments) streams the same lines live. Invocation logs add one line per request with method, URL and status; traces add timings of bindings and `fetch` calls. Workers Logs has a daily volume and a retention limit per plan; lower `head_sampling_rate` under `observability.logs` if a busy Worker goes over it.

## Another log backend (adapter sketch, not shipped)

A vendor adapter implements the port in its own folder; nothing else imports the SDK (dependency-cruiser `vendor-sdks-only-in-adapters`). Example: Datadog's HTTP intake, batched per request and flushed with `waitUntil` so the response never waits.

```ts
// packages/features/src/platform/adapters/datadog/datadog-logger.ts
import { toLogRecord, type LogRecord } from "../../log-record";
import type { LogFields, Logger, LogLevel } from "../../ports";

export function createDatadogLogger(options: {
  readonly apiKey: string; // a Worker secret, never a var
  readonly service: string;
  readonly waitUntil: (promise: Promise<unknown>) => void;
}): Logger {
  const build = (fields: LogFields): Logger => {
    const write = (level: LogLevel, event: string, extra?: LogFields) => {
      const record: LogRecord = toLogRecord(level, event, extra, fields);
      options.waitUntil(
        fetch("https://http-intake.logs.datadoghq.eu/api/v2/logs", {
          method: "POST",
          headers: {
            "DD-API-KEY": options.apiKey,
            "content-type": "application/json",
          },
          body: JSON.stringify([
            { ...record, service: options.service, status: level },
          ]),
        }).catch(() => {}) // a log backend outage must not fail the request
      );
    };
    return {
      debug: (e, f) => write("debug", e, f),
      info: (e, f) => write("info", e, f),
      warn: (e, f) => write("warn", e, f),
      error: (e, f) => write("error", e, f),
      child: (more) => build({ ...fields, ...more }),
    };
  };
  return build({});
}
```

For OpenTelemetry, the adapter maps each record to an OTLP log record and posts it to the collector the same way. Then:

1. `datadog-logger.contract.test.ts` calling `describeLoggerContract` with a harness that captures the request bodies (stub `fetch`, run `waitUntil` promises).
2. Add `"datadog"` to `LOG_SINKS` in `apps/web/src/lib/config.ts` and a branch in `buildPlatform`. The adapter needs `waitUntil`, so build it per request (from the execution context) rather than per isolate.
3. The API key as a secret: `.dev.vars.example`, `scripts/setup-secrets.ts`, [how-to-setup-ci.md](how-to-setup-ci.md) if the deploy needs it.
4. Set `LOG_SINK` in each environment of `wrangler.jsonc`; keep `observability` on for invocation logs and traces.

Errors go through their own port: [how-to-setup-error-reporting.md](how-to-setup-error-reporting.md). The rules for ports and adapters: [architecture/overview.md](../architecture/overview.md#ports-and-adapters).
