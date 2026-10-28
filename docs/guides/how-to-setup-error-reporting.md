# How to set up error reporting

How unexpected errors are reported (OpenTelemetry exception attributes on the request's trace), what the user sees instead of the error (a reference, and RFC 9457 Problem Details on HTTP routes), how to find a report from the reference a user quotes, and how to send reports to Sentry or another tracker by writing an adapter. Use when you choose or change `ERROR_REPORTER`, investigate a reported failure, handle an error in new server code, or connect an error tracker.

## What happens on an unexpected error

Expected failures are typed `DomainError`s, mapped to tRPC codes and HTTP statuses, and are not reported. Anything else is reported once, where it is caught, through the **ErrorReporter** port (`packages/features/src/platform/ports/error-reporter.ts`):

| Where it fails                           | Reported by                                                                      | The caller gets                                                                                                                                                      |
| ---------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A tRPC procedure (web app and MCP tools) | `reportInternalErrors` middleware in `apps/web/src/server/trpc/init.ts`          | `500`, message `Internal error`, `error.data.reference`, no stack                                                                                                    |
| An MCP tool outside a procedure          | `toolError` in `apps/web/src/server/mcp/server.ts`                               | Tool error `{ code: "INTERNAL_SERVER_ERROR", message, reference }`                                                                                                   |
| A file route                             | `internalErrorResponse` in `apps/web/src/server/http.ts`                         | `500`, `application/problem+json`: `{ type, title, status, detail, reference }`                                                                                      |
| Any other on-demand page or endpoint     | `withRequestContext` in `apps/web/src/server/http.ts`                            | The same Problem Details 500                                                                                                                                         |
| A background job                         | `apps/web/src/server/queue.ts`, on the final attempt or a permanent failure only | Retried with backoff; then acked (permanent) or moved to the dead-letter queue ([how-to-add-background-jobs.md](how-to-add-background-jobs.md#retries-and-failures)) |
| A cron entry                             | `apps/web/src/server/cron.ts`                                                    | The other entries still run; the run fails                                                                                                                           |

The reference is the trace id, also in the `x-request-id` response header and in `traceparent` ([how-to-setup-logging.md](how-to-setup-logging.md#trace-context)). The cause (message, stack) goes only to the report. In the UI, `ErrorState` takes `reference` and shows it as selectable text; `errorReference(error)` in `apps/web/src/lib/error-reference.ts` reads it from a tRPC client error or a Problem Details body.

New server code that catches an unexpected error reports it with the context of the work, using OpenTelemetry attribute names, and answers with the reference:

```ts
return internalErrorResponse(env, error, locals.requestContext, {
  ...httpAttributes(request),
  "http.route": "/api/things",
});
// or, outside HTTP:
const reference = platform.errors.capture(error, context, { "app.cron.name": name });
```

## ERROR_REPORTER

A required var in every environment of `apps/web/wrangler.jsonc`, with no default:

| Value          | Adapter                                                            | Report                                                                                                                                                                                                            |
| -------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workers-logs` | `createWorkersLogsErrorReporter` (`platform/adapters/cloudflare/`) | One OpenTelemetry log record: `severity_text: "ERROR"`, `body: "error.captured"`, `trace_id`/`span_id` of the failed work, `exception.type`, `exception.message`, `exception.stacktrace` and the extra attributes |
| `none`         | `noopErrorReporter`                                                | Nothing; users still get a reference                                                                                                                                                                              |

A missing or unknown value fails every request with a 500 naming the setting; `bun run doctor` checks it. It is independent of `LOG_SINK`: with `LOG_SINK=none` and `ERROR_REPORTER=workers-logs`, only error reports are written.

## Finding a report

A user sends the reference (`4bf92f35…`). In the Cloudflare dashboard, Workers & Pages → the Worker → Observability, filter `trace_id = 4bf92f35…`: the `error.captured` record has the stack, and the other records of the same trace (including the queue messages it sent) show what led there. With an OTLP destination configured ([how-to-setup-logging.md](how-to-setup-logging.md#forwarding-to-an-opentelemetry-backend)), search the backend by trace id instead. Locally the report is printed in the `bun run dev:web` output.

## Sentry (adapter sketch, not shipped)

The port is synchronous so a failing request never waits on the tracker: a network adapter queues the send with `waitUntil` and never throws. Sentry's SDK for Workers (`@sentry/cloudflare`) wraps the whole handler, which does not fit a port; posting the event to Sentry's store endpoint keeps the SDK out entirely. Sentry accepts the W3C trace id as its `trace_id`, so its events line up with the logs:

```ts
// packages/features/src/platform/adapters/sentry/sentry-error-reporter.ts
import type { RequestContext } from "../../../kernel";
import { exceptionAttributes, sanitize } from "../../log-record";
import type { ErrorReporter, LogFields } from "../../ports";

export function createSentryErrorReporter(options: {
  readonly dsn: string; // https://<key>@<org>.ingest.sentry.io/<project>, a Worker secret
  readonly waitUntil: (promise: Promise<unknown>) => void;
}): ErrorReporter {
  const dsn = new URL(options.dsn);
  const endpoint = `${dsn.origin}/api${dsn.pathname}/store/?sentry_key=${dsn.username}&sentry_version=7`;
  return {
    capture(error: unknown, context: RequestContext, extra?: LogFields) {
      const exception = exceptionAttributes(error);
      options.waitUntil(
        fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            level: "error",
            release: context.release,
            environment: context.environment,
            user: context.userId ? { id: context.userId } : undefined,
            contexts: {
              trace: { trace_id: context.traceId, span_id: context.spanId },
            },
            tags: { source: context.source },
            exception: {
              values: [
                {
                  type: exception["exception.type"],
                  value: exception["exception.message"],
                },
              ],
            },
            extra: {
              ...(sanitize(extra ?? {}) as object),
              stack: exception["exception.stacktrace"],
            },
          }),
        }).catch(() => {}) // the tracker being down must not fail the request
      );
      return context.traceId;
    },
  };
}
```

Then:

1. `sentry-error-reporter.contract.test.ts` calling `describeErrorReporterContract`, with a harness that stubs `fetch`, runs the `waitUntil` promises and maps each posted event to the record shape the contract reads (`trace_id`, `span_id`, `attributes` with `exception.*`).
2. Add `"sentry"` to `ERROR_REPORTERS` in `apps/web/src/lib/config.ts` and a branch in `buildPlatform`, built per request because it needs `waitUntil`.
3. `SENTRY_DSN` as a secret: `.dev.vars.example`, `scripts/setup-secrets.ts`, [how-to-setup-ci.md](how-to-setup-ci.md) if the deploy needs it.
4. Set `ERROR_REPORTER=sentry` in the environments that should use it. Keep Workers Logs on for the request's other records.

If you do adopt an SDK, import it only in its adapter folder: `apps/web/src/server` may not import `@sentry/*` and similar packages (dependency-cruiser `vendor-sdks-not-in-app-server`). Logs: [how-to-setup-logging.md](how-to-setup-logging.md). Rules and standards: [architecture/overview.md](../architecture/overview.md#ports-and-adapters).
