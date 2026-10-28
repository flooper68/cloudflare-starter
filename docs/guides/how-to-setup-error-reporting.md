# How to set up error reporting

How unexpected errors are reported, what the user sees instead of the error, how to find a report from the reference a user quotes, and how to send reports to Sentry or another tracker by writing an adapter. Use when you choose or change `ERROR_REPORTER`, investigate a reported failure, handle an error in new server code, or connect an error tracker.

## What happens on an unexpected error

Expected failures are typed `DomainError`s, mapped to tRPC codes and HTTP statuses, and are not reported. Anything else is reported once, where it is caught, through the **ErrorReporter** port (`packages/features/src/platform/ports/error-reporter.ts`):

| Where it fails                           | Reported by                                                             | The caller gets                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| A tRPC procedure (web app and MCP tools) | `reportInternalErrors` middleware in `apps/web/src/server/trpc/init.ts` | `500`, message `Internal error`, `error.data.reference`            |
| An MCP tool outside a procedure          | `toolError` in `apps/web/src/server/mcp/server.ts`                      | Tool error `{ code: "INTERNAL_SERVER_ERROR", message, reference }` |
| A file route                             | `internalErrorResponse` in `apps/web/src/server/http.ts`                | `500 { "error": "Internal error", "reference": "…" }`              |
| Any other on-demand page or endpoint     | `withRequestContext` in `apps/web/src/server/http.ts`                   | The same JSON 500                                                  |
| A queue message                          | `apps/web/src/server/queue.ts`                                          | The message is retried, then lands in the dead-letter queue        |
| A cron run                               | `apps/web/src/server/cron.ts`                                           | The run fails (rethrown)                                           |

The reference is the request id, also in the `x-request-id` response header. The cause (message, stack) goes only to the report. In the UI, `ErrorState` takes `reference` and shows it as selectable text; `errorReference(error)` in `apps/web/src/lib/error-reference.ts` reads it from a tRPC client error or a JSON error body.

New server code that catches an unexpected error reports it with the context of the work and answers with the reference:

```ts
const reference = platform.errors.capture(error, context, {
  route: "POST /api/things",
});
```

## ERROR_REPORTER

A required var in every environment of `apps/web/wrangler.jsonc`, with no default:

| Value          | Adapter                                                            | Report                                                                                             |
| -------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `workers-logs` | `createWorkersLogsErrorReporter` (`platform/adapters/cloudflare/`) | One `error`-level line, `event: "error.captured"`, with the error, stack, context and extra fields |
| `none`         | `noopErrorReporter`                                                | Nothing; users still get a reference                                                               |

A missing or unknown value fails every request with a 500 naming the setting; `bun run doctor` checks it. It is independent of `LOG_SINK`: with `LOG_SINK=none` and `ERROR_REPORTER=workers-logs`, only error reports are written.

## Finding a report

A user sends the reference (`3f6c1d2e-…`). In the Cloudflare dashboard, Workers & Pages → the Worker → Observability, filter `requestId = 3f6c1d2e-…`: the `error.captured` line has the stack, and the other lines of the same request (and of queue messages it sent) show what led there. Locally the report is printed in the `bun run dev:web` output.

## Sentry (adapter sketch, not shipped)

The port is synchronous so a failing request never waits on the tracker: a network adapter queues the send with `waitUntil` and never throws. Sentry's SDK for Workers (`@sentry/cloudflare`) wraps the whole handler, which does not fit a port; posting the event to Sentry's store endpoint keeps the SDK out entirely:

```ts
// packages/features/src/platform/adapters/sentry/sentry-error-reporter.ts
import type { RequestContext } from "../../../kernel";
import { sanitize } from "../../log-record";
import type { ErrorReporter, LogFields } from "../../ports";

export function createSentryErrorReporter(options: {
  readonly dsn: string; // https://<key>@<org>.ingest.sentry.io/<project>, a Worker secret
  readonly waitUntil: (promise: Promise<unknown>) => void;
}): ErrorReporter {
  const dsn = new URL(options.dsn);
  const endpoint = `${dsn.origin}/api${dsn.pathname}/store/?sentry_key=${dsn.username}&sentry_version=7`;
  return {
    capture(error: unknown, context: RequestContext, extra?: LogFields) {
      const serialized = sanitize(error) as {
        name?: string;
        message?: string;
        stack?: string;
      };
      options.waitUntil(
        fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            event_id: context.requestId.replaceAll("-", ""),
            level: "error",
            release: context.release,
            environment: context.environment,
            user: context.userId ? { id: context.userId } : undefined,
            tags: { requestId: context.requestId, source: context.source },
            exception: {
              values: [{ type: serialized.name, value: serialized.message }],
            },
            extra: {
              ...(sanitize(extra ?? {}) as object),
              stack: serialized.stack,
            },
          }),
        }).catch(() => {}) // the tracker being down must not fail the request
      );
      return context.requestId;
    },
  };
}
```

Then:

1. `sentry-error-reporter.contract.test.ts` calling `describeErrorReporterContract` with a harness that stubs `fetch`, runs the `waitUntil` promises and returns the posted events as reports.
2. Add `"sentry"` to `ERROR_REPORTERS` in `apps/web/src/lib/config.ts` and a branch in `buildPlatform`, built per request because it needs `waitUntil`.
3. `SENTRY_DSN` as a secret: `.dev.vars.example`, `scripts/setup-secrets.ts`, [how-to-setup-ci.md](how-to-setup-ci.md) if the deploy needs it.
4. Set `ERROR_REPORTER=sentry` in the environments that should use it. Keep Workers Logs on for the request's other lines.

If you do adopt an SDK, import it only in its adapter folder: `apps/web/src/server` may not import `@sentry/*` and similar packages (dependency-cruiser `vendor-sdks-not-in-app-server`). Logs: [how-to-setup-logging.md](how-to-setup-logging.md). Rules: [architecture/overview.md](../architecture/overview.md#ports-and-adapters).
