# Evidence: platform-ports, OpenTelemetry and W3C Trace Context revision

Produced on 2026-10-28 from branch `platform-ports` (after the rebase onto #13) with `astro dev` in `apps/web` (`.dev.vars` copied from `.dev.vars.example`, so `APP_ENV=local`; `LOG_SINK` and `ERROR_REPORTER` are `workers-logs` from `wrangler.jsonc`), a local test account, curl, and the Claude desktop browser pane (Chromium, 800x600).

| File | What it shows |
| --- | --- |
| `curl-trace-headers.txt` | `traceparent` and `x-request-id` (the trace id) on a 200 and a 302. A client-chosen `x-request-id` is ignored. A valid incoming `traceparent` (`4bf92f35…`) is continued with a new span id |
| `curl-enqueue-hello.txt` | `queue.enqueueHello` answers with trace `c694cf6c…` |
| `dev-server-log-records.txt` | OpenTelemetry log records: the consumer's `queue.hello` on the same `trace_id` `c694cf6c…` (its own `span_id`, `messaging.*` attributes, `resource`), and an `error.captured` record with `exception.type/message/stacktrace`, `rpc.*` and `user.id` for trace `7cc7bc8f…` |
| `queue-demo-error-reference-dark.jpg`, `-light.jpg` | `/app/queue-demo` after the failure: inline `ErrorState` with the reference `7cc7bc8f…` (the trace id in the record above), both themes (light via `prefers-color-scheme` emulation) |
| `mcp-tool-error.json` | `tools/call enqueue_hello` against the in-process MCP server (web-api test harness, the same server `/mcp` builds) with the queue send failing: `isError`, `INTERNAL_SERVER_ERROR`, `reference` = trace id |

To produce the internal error, `queue.enqueueHello` was made to throw for the name `boom` (`EVIDENCE-ONLY: queue broker unreachable`) in an uncommitted local edit, reverted afterwards. Local absolute paths in stacks are replaced by `<repo>`.
