# Evidence: platform-ports

Produced on 2026-10-28 from branch `platform-ports` with `astro dev` in `apps/web` (local bindings, `.dev.vars` copied from `.dev.vars.example`, `LOG_SINK=workers-logs`, `ERROR_REPORTER=workers-logs` from `wrangler.jsonc`), a test account signed up through `/api/auth/sign-up/email`, curl, and the Claude desktop browser pane (Chromium) at 800x600.

| File | What it shows |
| --- | --- |
| `curl-x-request-id.txt` | `x-request-id` on a 200, a 302 redirect and a 401 from `/mcp`; an incoming `x-request-id: client-chosen` is ignored |
| `curl-enqueue-hello.txt` | `queue.enqueueHello` returns `x-request-id: 2db0c6c8-…` |
| `dev-server-log-lines.txt` | The consumer's `queue.hello` line reusing `requestId 2db0c6c8-…` (source `queue`, release from `CF_VERSION_METADATA`), and an `error.captured` report with stack and context for reference `952bec74-…` |
| `curl-trpc-internal-error.txt` | An internal tRPC error: message `Internal error`, no stack, `data.reference` equal to the `x-request-id` header |
| `queue-demo-error-reference-dark.jpg`, `-light.jpg` | `/app/queue-demo` after the failure: inline `ErrorState` with the reference, both themes (light via `prefers-color-scheme` emulation) |
| `mcp-tool-error.json` | `tools/call enqueue_hello` against the in-process MCP server (web-api test harness, the same server `/mcp` builds) with the queue send failing: `isError`, `INTERNAL_SERVER_ERROR`, `reference` = request id |

To produce an internal error, `queue.enqueueHello` was made to throw (`EVIDENCE-ONLY: queue broker unreachable`) in an uncommitted local edit, reverted afterwards; the MCP capture used the API test's `APP_QUEUE.send` rejection. Local absolute paths in stacks are replaced by `<repo>`.
