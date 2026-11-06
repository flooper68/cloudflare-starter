# How to set up and deploy the web app

This guide explains how to run and deploy the Astro web app in this repo.

The web app lives in [apps/web](../../apps/web/README.md). It is one Worker: the Cloudflare Astro adapter serves HTTP (Better Auth sign-in, Astro SSR pages, a React SPA at `/app/*`, tRPC and REST), and [src/worker.ts](../../apps/web/src/worker.ts) adds the queue consumer and Cron Triggers. Data is in D1, files in R2.

## What You Need

1. Bun.
2. A Cloudflare account, and Wrangler logged in (`bunx wrangler login`).

That is enough to run locally: D1, R2 (binding), the queue and cron all run inside Wrangler, and auth needs no external provider.

Optional:

- R2 API credentials for the presigned-URL half of `/app/upload-demo` ([how-to-setup-r2.md](./how-to-setup-r2.md))
- A sender domain on Cloudflare for real mail in deployed environments ([how-to-setup-email.md](./how-to-setup-email.md)); locally email is simulated
- A Google OAuth client for "Continue with Google" ([how-to-setup-auth.md](./how-to-setup-auth.md))

Official references:

- [Astro on Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/)
- [Cloudflare Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)

## Runtime Values

Bindings come from [apps/web/wrangler.jsonc](../../apps/web/wrangler.jsonc), repeated per environment: `DB` (D1), `FILES` (R2), `EMAIL` (send_email), `APP_QUEUE` (producer, and this Worker is also the consumer), `CF_VERSION_METADATA` (version metadata, logged as `release`), `METRICS_DATASET` (Workers Analytics Engine, the metrics), the Workers Rate Limiting bindings `RL_AUTH_IP`, `RL_MUTATION`, `RL_MCP_IP`, `RL_MCP_USER`, `RL_UPLOAD`, `RL_INVITE`, `RL_TOKEN_LOOKUP`, `RL_BILLING_WEBHOOK`, `RL_ANALYTICS`, `RL_UNSUBSCRIBE`, `RL_HEALTH` (`ratelimits`, nothing to create), Cron Triggers, and `observability` (Workers Logs and traces). Plain vars there: `APP_ENV` (required, no default: `develop`, `staging`, `production`; `local` only in `.dev.vars`), `LOG_SINK` and `ERROR_REPORTER` (required, `workers-logs` or `none`; [how-to-setup-logging.md](how-to-setup-logging.md), [how-to-setup-error-reporting.md](how-to-setup-error-reporting.md)), `METRICS` (required, `analytics-engine` or `none`) and `TRACING` (required, `workers` or `none`; [how-to-setup-metrics-and-tracing.md](how-to-setup-metrics-and-tracing.md)), `STORAGE_RECONCILE` (required, `off`, `report` or `delete`; shipped `off`, `report` in production; [storage reconciliation](how-to-use-trash.md#optional-storage-reconciliation)), `AUTH_EMAIL_PASSWORD` and `AUTH_REQUIRE_EMAIL_VERIFICATION` (required, `true` or `false`; shipped `true`, and `false` except `true` in production; [how-to-setup-auth.md](how-to-setup-auth.md#sign-in-methods)), `EMAIL_FROM`, `EMAIL_FROM_NAME`, and the required abuse-protection settings `RATE_LIMITING` (`cloudflare`|`none`), `TURNSTILE` (`on`|`off`), `TURNSTILE_SITE_KEY` ([how-to-configure-abuse-protection.md](./how-to-configure-abuse-protection.md)). Code reads them with `import { env } from "cloudflare:workers"`. Locally `.dev.vars` sets `APP_ENV=local`, overriding `develop`: it marks local development, the only environment where auth links may be logged when email is off ([how-to-setup-auth.md](how-to-setup-auth.md)).

Secrets, validated in [apps/web/src/lib/config.ts](../../apps/web/src/lib/config.ts):

| Name                                       | Required                          | Notes                                               |
| ------------------------------------------ | --------------------------------- | --------------------------------------------------- |
| `APP_URL`                                  | yes                               | Public origin, no trailing slash                    |
| `BETTER_AUTH_SECRET`                       | yes                               | 32+ characters, one per environment                 |
| `TURNSTILE_SECRET_KEY`                     | with `TURNSTILE=on`               | The Turnstile widget's secret key                   |
| `ANALYTICS_ID_SECRET`                      | with `ANALYTICS=analytics-engine` | 32+ characters; keys the pseudonymous analytics ids |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | no                                | Enables Google sign-in                              |
| `R2_*`                                     | no                                | Presigned R2 URLs                                   |

`bun run doctor` checks the local setup and points out what is missing for each environment.

## Run Locally

```bash
bun install
cp apps/web/.dev.vars.example apps/web/.dev.vars   # or: bun run setup:secrets
bun run db:migrate:local
bun run doctor
bun run dev:web
```

Open `APP_URL` (`http://localhost:4321` from `.dev.vars.example`; `bun run setup:secrets` proposes a port per checkout, so worktrees can run side by side, and the dev server listens on that port), create an account at `/sign-up`, and you land on `/app/dashboard` in your personal workspace (multi mode, open sign-up, from `.dev.vars`; [how-to-configure-workspaces.md](./how-to-configure-workspaces.md)). Blank values in `.dev.vars` count as unset.

Queue and cron run in the same dev server:

- `/app/queue-demo` enqueues a `greetings.hello` job; the consumer logs a `body: 'greetings.hello'` record in the dev output, with the `trace_id` of the request that queued it.
- `curl "http://localhost:4321/cdn-cgi/local/scheduled?cron=17+3+*+*+*"` runs the cron entries of that schedule (the daily purges of audit events, idempotency keys, notifications and trash, trial expiry and storage reconciliation), which log `cron.completed` and enqueue their jobs ([how-to-add-background-jobs.md](how-to-add-background-jobs.md#run-it-locally)).

Every response has `traceparent` and `x-request-id` headers; the trace id in them is the `trace_id` of that request's log records.

## Deploy

Per environment (`develop`, `staging`, `production`); every script takes `--dry-run`.

1. Log in: `bunx wrangler login`.
2. Create D1, R2 and the queues (with dead-letter queues, kept 14 days), and write the D1 id into `wrangler.jsonc`:

   ```bash
   bun run setup:cloudflare --env production --dry-run  # the plan
   bun run setup:cloudflare --env production            # add --jurisdiction eu to keep data in the EU
   ```

   With `--jurisdiction eu` the script also writes `"jurisdiction": "eu"` into the environment's `r2_buckets` entry. It also gives the Workers Rate Limiting bindings `namespace_id`s from the project's own block when they are still the starter's: the ids are account-wide, so a project that kept the starter's would share its rate-limit counters with every other one that did ([how-to-configure-abuse-protection.md](./how-to-configure-abuse-protection.md#namespace-ids)).

3. Domain: the environment's hostname goes into `routes` of its block in `wrangler.jsonc` as a [Custom Domain](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/), and `"workers_dev": false` turns off the `*.workers.dev` URL. The zone must be in the same account and the hostname must have no DNS record yet; the deploy creates the record and the certificate. `APP_URL` (step 7) is then `https://<hostname>`. The starter's own production uses `starter.flooper.me`:

   ```jsonc
   "routes": [{ "pattern": "starter.flooper.me", "custom_domain": true }],
   "workers_dev": false,
   ```

   A project replaces that hostname with its own (or removes both lines to stay on `workers.dev`). `wrangler deploy --dry-run` lists bindings, not routes: after `CLOUDFLARE_ENV=production bun run deploy:dry-run` in `apps/web`, the route is in `routes` of the built `dist/server/wrangler.json`.

   Email, if the environment sends mail ([how-to-setup-email.md](./how-to-setup-email.md#choosing-the-sender)). The sender's domain must be onboarded to Email Service; it can differ from the app's hostname (the starter's production sends as `starter@flooper.me`):

   ```bash
   bun run setup:email --domain example.com --from noreply@example.com --env production
   ```

   A `BOOTSTRAP_ADMIN_EMAIL` needs `AUTH_REQUIRE_EMAIL_VERIFICATION=true` (the starter's production sets it), and that needs `EMAIL_FROM`: the Worker refuses to start with verification on and no sender.

4. Sign-in, account security, workspaces, sign-up, billing and the admin portal: the starter ships no choice for most of them, and the Worker refuses to start without one ([how-to-configure-workspaces.md](./how-to-configure-workspaces.md), [how-to-configure-account-security.md](./how-to-configure-account-security.md)):

   ```bash
   bun run setup:auth --env production --dry-run
   bun run setup:auth --env production
   ```

   Analytics, the same way: no choice is shipped ([how-to-setup-product-analytics.md](./how-to-setup-product-analytics.md)); with `ANALYTICS=analytics-engine` step 7 also sets `ANALYTICS_ID_SECRET`:

   ```bash
   bun run setup:analytics --env production --dry-run
   bun run setup:analytics --env production
   ```

   Data exports: add the R2 lifecycle rule that expires export archives ([how-to-handle-data-privacy.md](./how-to-handle-data-privacy.md#storage-expiry-setup)); it changes the bucket, so run it for real only after the owner agrees:

   ```bash
   bun run setup:privacy-storage --env production --dry-run
   ```

5. Turnstile, while `TURNSTILE=on` (the default in every environment): create a Managed widget for the environment's hostname in the Cloudflare dashboard and put its site key in that environment's `TURNSTILE_SITE_KEY` in `wrangler.jsonc` (the shipped value is Cloudflare's test key; `setup:cloudflare` prints these steps). Its secret key is set in step 7. Details: [how-to-configure-abuse-protection.md](./how-to-configure-abuse-protection.md#deployed-environments).

6. Migrate, build and deploy:

   ```bash
   cd apps/web
   bunx wrangler d1 migrations apply DB --remote --env production
   bun run deploy:production
   ```

7. Secrets, including `TURNSTILE_SECRET_KEY` and `ANALYTICS_ID_SECRET` (asks for each one, sends them on stdin; this deploys a new version):

   ```bash
   bun run setup:secrets --env production
   ```

   On a brand-new Worker the first deploy answers 500 until the secrets are set a minute later; afterwards secrets persist across deploys.

The environment is picked when building: `deploy:production` runs `CLOUDFLARE_ENV=production bun run build && wrangler deploy`, and `build` builds Storybook into the app first. Running `wrangler deploy --env production` on a bundle built without `CLOUDFLARE_ENV` would deploy the develop config. Use `bun run deploy` for develop and `deploy:staging` for staging. Storybook ships with the app at `/_storybook/` ([how-to-use-storybook.md](./how-to-use-storybook.md)), and the build prerenders the docs site at `/docs` from the repository's Markdown of the commit it builds ([how-to-publish-docs-and-landing.md](./how-to-publish-docs-and-landing.md)).

## Queues and Cron

Background jobs, the queue consumer, retries, the dead-letter queue and the cron catalog (including the daily audit purge, [how-to-use-the-audit-log.md](how-to-use-the-audit-log.md)) are in [how-to-add-background-jobs.md](how-to-add-background-jobs.md). Logs: `bunx wrangler tail --env production`, or Workers Logs in the dashboard; filtering and fields in [how-to-setup-logging.md](how-to-setup-logging.md).

## Verify

1. `curl https://<your-worker-url>/api/hello` returns a JSON hello.
2. Sign up (the Turnstile widget appears and passes), sign out, sign in.
3. Signed-in visits to `/` land on `/app/dashboard`; signed-out visits to `/app/*` land on `/sign-in`.
4. Try the demos you configured.
5. `/docs/` shows the docs index and a guide opens from its navigation.
6. `curl -i https://<your-worker-url>/health/ready` answers 200 with `"status":"pass"`; point an uptime monitor at it ([how-to-monitor-health.md](how-to-monitor-health.md)).

## Common Problems

### Every page returns 500 with a zod error

A required setting is missing or wrong; the error names it. Check `APP_URL` and `BETTER_AUTH_SECRET` (32+ characters) in `.dev.vars` or the Worker secrets, `RATE_LIMITING` and `TURNSTILE` in the vars, and `TURNSTILE_SECRET_KEY` when `TURNSTILE=on` ([how-to-configure-abuse-protection.md](./how-to-configure-abuse-protection.md#troubleshooting)).

### Every request returns 500 "LOG_SINK is not set" (or ERROR_REPORTER, FEATURE_FLAGS, METRICS, TRACING, APP_ENV)

The var is missing from this environment's `vars` in `wrangler.jsonc`, or `.dev.vars` has a blank `LOG_SINK=` line that unsets it. Set it to `workers-logs` or `none` (`FEATURE_FLAGS`: `d1` or `none`; `METRICS`: `analytics-engine` or `none`; `TRACING`: `workers` or `none`), or `APP_ENV` to the environment's name ([how-to-setup-logging.md](how-to-setup-logging.md), [how-to-use-feature-flags.md](how-to-use-feature-flags.md#feature_flags)); `bun run doctor` points at the environment. "the METRICS_DATASET binding is missing" means `METRICS=analytics-engine` in an environment without `analytics_engine_datasets` ([how-to-setup-metrics-and-tracing.md](how-to-setup-metrics-and-tracing.md#metrics-and-tracing)).

### A user reports an error with a reference

The reference is the trace id. Search Workers Logs for `trace_id = <reference>` ([how-to-setup-error-reporting.md](how-to-setup-error-reporting.md#finding-a-report)).

### `no such table: user`

Migrations were not applied to this database. Run `bun run db:migrate:local`, or the remote command for the environment.

### Sign-in succeeds but you bounce back to `/sign-in`

`APP_URL` does not match the origin in the browser (scheme, host, port), so the cookie or origin check fails.

### Queue demo fails

The queue and its `-dlq` must exist for the environment before deploying (`bun run setup:cloudflare`); Wrangler refuses to deploy a consumer for a missing queue. Every request returns 500 "APP_QUEUE is not bound" when the environment lacks the producer binding.

### Upload or email demos fail

The presigned upload and the email demo need their own secrets; the error message names what is missing. The binding upload needs only the bucket.
