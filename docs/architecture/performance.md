# Performance

The approach a project built from this starter takes to performance: which targets it defines, which checks exist and where each fits next to the [test layers](testing.md#layers), how the Cloudflare platform shapes the design, and how a regression is handled. The starter itself ships no performance tooling, no targets and no budgets; a project adopts this approach, records its targets below and implements the checks it needs, cheapest first. Use when you define performance targets, add a performance check, review a change that touches queries, bundles or request paths, or handle a regression.

## Where to start

A project picks which checks to implement and in what order. Recommended first steps, both cheap and deterministic:

1. **D1 query budgets** in integration tests, for the use cases behind the key procedures.
2. **Bundle-size budgets** checked after `bun run build`.

Add the rest when the product has users or data volume that make them worth their cost. Each check, when implemented, follows the enabler rule in [testing.md](testing.md#enablers): its command goes into `package.json`, its documentation into this doc and [how-to-setup-ci.md](../guides/how-to-setup-ci.md) if CI runs it.

## Targets

Each project defines user-facing targets and records them in this section (replace the placeholder row). A target names what is measured, the threshold, the conditions and where it is checked.

| Target                       | Example of a project's entry                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| Server latency per procedure | `storage.listFiles`: p95 under 200 ms at 10 000 files per user, measured in production     |
| Core Web Vitals per key page | `/app` dashboard: LCP under 2.5 s, INP under 200 ms, CLS under 0.1 at p75, from field data |
| Client JS per page           | `/app/*`: under 200 KB gzip of JS on first load; marketing pages: under 50 KB              |
| D1 work per use case         | `listOwnedFiles`: 1 query, rows read at most `limit` (index on owner and date)             |

Project targets:

| Target                    | Threshold | Conditions | Checked by |
| ------------------------- | --------- | ---------- | ---------- |
| _none set in the starter_ |           |            |            |

Targets are stated at a data volume, because most regressions on this stack come from queries that grow with the data. Server latency is a production percentile, never a local timing.

## Checks

| Check                       | What it catches                                                              | Where it runs                                                      | Deterministic | Use as a gate                                         |
| --------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------- | ----------------------------------------------------- |
| D1 query budgets            | N+1 queries, full scans, a use case that reads far more rows than it returns | Integration layer, real local D1                                   | Yes           | Yes                                                   |
| Query plans                 | Missing or unused indexes                                                    | Review, with `EXPLAIN QUERY PLAN` against local D1                 | Yes           | By review                                             |
| Bundle-size budgets         | Heavy client dependencies, server code leaking into the client bundle        | After `bun run build`                                              | Yes           | Yes                                                   |
| Lighthouse / lab Web Vitals | Slow page loads, layout shift, render-blocking resources                     | Against the built app (`astro build` + preview, or a staging URL)  | No (noisy)    | Warn first; gate only with repeated runs and a margin |
| Load tests                  | Latency and errors under concurrency, D1 contention, limits hit              | Run deliberately against a staging deployment                      | No            | No; a report attached to the PR that needs it         |
| Production observation      | Everything real users experience                                             | Workers analytics and observability, D1 insights, field Web Vitals | n/a           | Source of truth for the targets                       |

### D1 query budgets

An integration test calls the use case on [seeded data](#data-for-performance-checks) and asserts how many statements it ran and how many rows they read. D1 reports both per statement in the result `meta` (`rows_read`, `rows_written`, `duration`); the test wraps the D1 binding it passes to the use case so each statement's `meta` is recorded. Budgets are on query count and rows read, not on `duration`, which varies by machine. A use case that lists N items and runs N+1 queries, or reads every row of a table to return one page, fails the budget.

### Indexes and query plans

Every `WHERE`, `JOIN` and `ORDER BY` column a query uses is covered by an index declared in the feature's `*.schema.ts`, so the migration creates it. Check the plan of a new or changed query against local D1:

```bash
cd apps/web && bunx wrangler d1 execute DB --local --command "EXPLAIN QUERY PLAN SELECT ..."
```

`SCAN <table>` on a table that grows with users or data is a finding; `SEARCH <table> USING INDEX` is what you want. The PR states the plan for each new query on such a table.

### Bundle budgets

After `bun run build`, the client assets for each page are measured (gzip size) and compared with the budget in [Targets](#targets). The Worker bundle size is also bounded by Cloudflare's script size limit; `wrangler deploy --dry-run` reports it.

### Lab Web Vitals

Lighthouse or a Web Vitals run against the built app, never `astro dev` (dev mode does not bundle or minify). Results vary between runs and machines: start as a warning in the PR, use the median of several runs, and turn a metric into a gate only once its variance is known and the threshold leaves room for it.

### Load tests

A k6- or autocannon-style script against a staging deployment with seeded data, run on purpose for a change that may affect throughput (a new hot path, a schema change on a large table, a new subrequest per request). Local workerd timings do not predict production: no network, a local SQLite file instead of D1's storage, no isolate distribution. Never point a load test at production, and check the Cloudflare plan's limits and billing before running one.

### Production observation

Production is where the targets are measured. Workers observability (logs, invocation metrics, CPU time and wall time per request) and D1 insights (slowest and most row-reading queries) show the real behaviour; field Web Vitals come from real browsers. A regression found here gets a check at the cheapest layer that would have caught it.

## Data for performance checks

Performance checks run on seeded data at realistic volumes (the volume named in the target), built by a seed factory per feature, deterministic (fixed clock and ids), and kept apart from the small functional fixtures in [testing.md](testing.md#fixtures-and-test-data). Functional tests stay small and fast; a query budget test seeds what it needs in that one file and stays within the integration [speed budget](testing.md#speed-budget). Staging load tests use a seed run against the staging database, never copied production data.

## Platform constraints

The Workers platform sets hard limits; the current values per plan are in Cloudflare's [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

| Concern                  | What it means for design                                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CPU time per request     | Counted while code runs, not while it waits on I/O. Heavy parsing, hashing, image or PDF work belongs in a queue consumer, a Container, or a dedicated service |
| Subrequests per request  | Each `fetch`, and each binding call on some plans, counts. Avoid a subrequest per item in a loop; batch instead                                                |
| D1 rows read and written | Billed per row and they drive latency. Select only needed columns, paginate, index filters, use `db.batch` for several statements in one round trip            |
| Large transfers          | Upload and download big files directly to R2 with presigned URLs ([how-to-setup-r2.md](../guides/how-to-setup-r2.md)), not through the Worker                  |
| Slow or retryable work   | Send it to `APP_QUEUE` and return; the consumer does the work with its own limits and retries                                                                  |
| Caching                  | Cache public, rarely changing responses (static assets, public pages) with `Cache-Control` and the Cache API; never cache per-user data in a shared cache      |

## Regressions and budget changes

- A check that fails is a regression until shown otherwise. Fix the code, or change the budget.
- Changing a budget or a target is part of the diff: the PR says the old and new value, why (more data per request, a feature that is worth the bytes), and the owner agrees.
- A production regression is handled like a bug: a check at the cheapest layer that reproduces it, then the fix ([testing.md](testing.md#change--required-test)).
