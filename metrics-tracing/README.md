# Evidence: metrics-tracing

## span-records-local-dev.txt

Span records (body `trace.span`) and one log record, as `bun run dev:web` printed them (`astro dev --port 4391`, `TRACING=workers`, `METRICS=analytics-engine` from wrangler.jsonc, `APP_ENV=local`). Requests, made with curl against the local dev server:

1. `GET /api/hello` → server span `GET /api/hello`, `http.route` from Astro's `routePattern`.
2. `POST /api/auth/sign-up/email` → server span `POST /api/auth/[...all]` (route template, never the raw path).
3. `GET /api/trpc/health.hello` with the session cookie and `traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01` → server span `GET /api/trpc/[...trpc]` continues the incoming trace (trace id `4bf92f35…`, parent `00f067aa0ba902b7`, its span id `81f320485145bc4d` is the one in the response `traceparent`); procedure span `health.hello` is its child.
4. `POST /api/trpc/queue.enqueueHello` → server span, procedure span `queue.enqueueHello`, then the queue consumer: the `queue.hello` log record and the consumer span `process cloudflare-starter-develop` share span id `a0edb68d74061dd9`, its parent is the producing procedure span `8e8c23bf5163dc7f`, all on trace `f77a1eb4…`.

Durations come from the Workers clock (advances on I/O only).

## analytics-engine-data-points.txt

The data points written to the simulated `METRICS_DATASET` Analytics Engine binding (workerd, `@cloudflare/vitest-plugin`, the app's wrangler.jsonc) for one HTTP request to `GET /api/trpc/storage.listFiles` as a signed-in user, captured with a pass-through spy on `writeDataPoint` in a throwaway API test: `EVIDENCE_RAW` is what the adapter wrote (index1 = metric name, blob1… = attributes in catalog order, blob16–20 = kind, unit, service, environment, version; double1–4 = sum, count, min, max, double5… = bucket counts), `EVIDENCE_DECODED` the same points read back with `fromDataPoint`. Two points from one flush: `rpc.server.call.duration` and `http.server.request.duration`. No user id appears in either.

The memory-adapter equivalents (series and span records asserted in tests) are in `apps/web/test/api/observability.test.ts`, `apps/web/src/server/{queue,cron}.test.ts` and `apps/web/src/server/mcp/server.test.ts`.
