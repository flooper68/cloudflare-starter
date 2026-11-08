# How to add background jobs

::reviewed{date="2026-11-09"}

Do slow work after the response: a job is typed, retried with backoff, never runs twice for the same key, and lands in a dead-letter queue kept 14 days when it keeps failing. Schedules (cron) live in one catalog. Use this guide to add a job or a schedule, run them locally, or replay a failed job. Every job and schedule: [Catalogs › Jobs and schedules](../reference/catalogs.md#jobs-and-schedules).

::flow[Use case or schedule -> enqueueJob -> Queue -> Handler -> Retry, then dead-letter]{title="Job flow: a use case or a schedule enqueues a job, the consumer runs its handler, a failure retries and then dead-letters"}

## Add a job

:::steps
1. **Declare it** in the owning feature's domain with `defineJob({ type, payload, backoff, idempotencyKey? })`. Keep the payload small: ids, not records.
2. **Write the handler** as a use case with explicit deps, and register it in `packages/features/src/job-catalog.ts`.
3. **Enqueue it** from a use case: `await enqueueJob(deps, job, payload, { context })`.
4. **Test it**: the payload schema, the handler against a real database, and that the use case enqueues it.
   :::

:::prompt{title="Paste this into your coding agent"}
```text
Add a background job <feature>.<job> that <does what>: define it with a backoff and an
idempotency key, write and register the handler, enqueue it from <use case>, and add the
tests. Follow docs/guides/how-to-add-background-jobs.md.
```
:::

A schedule is one entry `{ name, schedule, run }` in `packages/features/src/cron-catalog.ts`, with the same cron string in `triggers.crons` of every environment of `apps/web/wrangler.jsonc` (a test compares them).

## Run it locally

`bun run dev:web` runs the producer, the consumer and the schedules. `/app/queue-demo` enqueues a test job; to run a schedule:

```bash
curl "http://localhost:4321/cdn-cgi/local/scheduled?cron=17+3+*+*+*"
```

## Replay a failed job

:::byhand
1. Find it: the `error.captured` log record with `app.job.outcome = dead_lettered` gives the trace id, job id and type.
2. Look at the message: Cloudflare dashboard › Queues › `cloudflare-starter-<env>-dlq` › Messages.
3. Fix the cause and deploy.
4. Send the same envelope back to the main queue (same `id`, `traceparent` and `idempotencykey`), so it continues the trace and stays deduplicated.
   :::

:::decision{title="Jobs or Workflows"}
Jobs fit short steps with retries. A long process that must resume after each step is a Workflow ([jobs or Workflows](../reference/background-jobs.md#jobs-or-workflows)).
:::

:::gotcha{title="A job missing from the catalog is dropped"}
It is acknowledged and reported as unknown, never retried.
:::

## Reference

The envelope, retries and failures, idempotency, the dead-letter queue, why there is no noop queue, and common problems: [Background jobs reference](../reference/background-jobs.md).
