# 0005. One Worker for HTTP, queue consumer and cron

- Status: Accepted
- Date: 2026-10-28

## Context

The app serves HTTP, consumes a queue and runs scheduled jobs. All three need the same bindings (D1, R2, email, secrets) and the same feature code. Separate Workers would each need those bindings declared per environment and would deploy independently of the code that produces their work.

## Decision

The web Worker (`apps/web`) handles all three. `apps/web/src/worker.ts` exports `fetch` (the Astro handler), `queue` and `scheduled`; `wrangler.jsonc` declares the queue consumer and `triggers.crons` next to the bindings. A handler moves into its own Worker only when it needs separate scaling, limits or deploys. The Container demo stays a separate Worker because its Docker image is built on every deploy of its Worker.

## Consequences

Positive:

- Bindings and secrets are declared once per environment.
- Producer and consumer deploy together, so message shapes never drift between them.
- One thing to deploy, monitor and roll back.

Negative:

- A slow consumer or cron job shares the Worker's limits and deploy cadence with HTTP.
- A bad deploy affects all three at once.
- The custom entry (`main: ./src/worker.ts`) replaces the adapter's default entry and has to be kept in sync with it.

## Alternatives considered

- **A separate Worker per handler.** Bindings and secrets repeated per Worker and environment, independent deploys that can drift from the producer, more to provision. Rejected for the default; still allowed when a handler needs separate scaling, limits or deploys.
