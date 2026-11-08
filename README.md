# Cloudflare Starter

A Bun monorepo for building Cloudflare-first products: one Astro web Worker that serves the site, a Better Auth–protected React SPA, the API, a queue consumer and Cron Triggers, plus a shared feature package, a component library with Storybook at `/_storybook`, and an optional Container Worker.

## Highlights

- Astro 7 + React 19 on Cloudflare Workers: a prerendered landing page and docs site (the repository's Markdown at `/docs`, with search), SSR auth pages and a client-routed SPA under `/app/*`
- Better Auth: email + password and/or Google, switched by env; optional email verification with "Check your inbox" (rate-limited resend) and "Email verified" screens; users and sessions in D1
- Account security: authenticator two-factor with recovery codes and optional emailed codes, passkey sign-in, enrollment policy per environment (off, optional, required for admins, required), and MCP access bound to the browser session that granted it; Settings › Connected agents lists every agent a person allowed and disconnects it at once; destructive admin actions need a fresh second factor
- Account and workspace settings: profile and avatar, verified email changes, linked accounts, own sessions, locale, time zone and theme, workspace name and logo, confirmed workspace and account deletion; tRPC procedures and MCP tools
- Workspaces: data belongs to workspaces, never users; personal, single or multi-workspace mode; open or invite-only sign-up (domain allowlist, bootstrap admin); invitations by email; roles from one permission map; members page, switcher and MCP tools
- Admin portal for platform admins (`ADMIN_PORTAL`, Better Auth's admin plugin behind our own use cases): users (search, suspend, sign out, reset password or second factor, role, erase), impersonation, workspace rescue and deletion, data requests, storage maintenance, audit log, a D1 overview and read-only settings; every action audited, destructive ones behind a recent sign-in and second factor, and an `admin_*` MCP tool for each except the browser-only erasure, factor reset and impersonation
- Plans and limits per workspace: a catalog in code (plans, add-ons, gated features, usage limits), trials with a daily expiry cron, admin overrides, usage counters, `limit_reached` errors with upgrade options over tRPC, MCP and HTTP, `BILLING=off|manual|provider`, a provider port for a project's own payment adapter (Stripe sketched; no vendor SDK), a billing page with usage meters, upgrade prompts where a limit stops someone (uploads, invitations), a trial banner, and a billing panel in the admin portal
- MCP server at `/mcp` with OAuth (Claude signs in as the user, after a consent page in plain words); people see and disconnect the agents they allowed in Settings › Connected agents; a test fails the build if any API lacks an MCP tool or a reasoned exemption
- Abuse protection: one rate-limit catalog enforced by Workers Rate Limiting bindings and Better Auth on every mutation, auth endpoint, upload and `/mcp`; Cloudflare Turnstile on sign-up, sign-in and password reset; a test fails the build if a mutation or route has neither a policy nor a reasoned exemption
- Security headers after the OWASP Secure Headers Project on every response (pages, API, `/mcp`, auth, health, static assets): a strict CSP Level 3 per page (scripts only from the app's bundles and Astro-hashed inline code, no `unsafe-inline` scripts; Turnstile, Web Analytics and R2 uploads allowed only when on), `CSP_MODE=enforce|report-only`, violation reports logged through `/api/csp-report`, HSTS when deployed, and every E2E journey failing on any CSP violation ([guide](docs/guides/how-to-configure-security-headers.md))
- Health endpoints for uptime monitors and status pages: `/health/live` and `/health/ready` (alias `/health`) in the IETF health check format (`application/health+json`), D1, R2, bindings and settings checked with deadlines, 503 on failure, no-store, rate limited, failure details only in the logs and the admin portal ([guide](docs/guides/how-to-monitor-health.md))
- Placeholder apps in the sidebar that show where a project's product goes: **Notes**, a thin real feature wired end to end (D1 tables, permissions, a plan limit, trash, audit and product events, tRPC, MCP tools, rate limits, privacy catalog, screens and tests; the worked example of [how-to-add-a-feature.md](docs/guides/how-to-add-a-feature.md)), and **Tasks**, a sample board and list from the component library with no backend
- A ⌘K (Ctrl+K) command palette in the app shell: every page the user may open (from the one navigation list the sidebar uses too), a debounced search of the workspace's notes, workspace switching and common actions; full screen on phones, and a search provider per feature ([guide](docs/guides/how-to-add-a-feature.md#navigation-and-the-command-palette))
- A starter dashboard with a getting-started checklist (verify email, invite a teammate, two-factor, first note), developer demos moved to `/app/demos`, and the system screens every app needs: an in-app 404, a 403 that names who can grant access, an offline notice, and an MCP consent page with the scopes in plain words
- Tests at every layer, all in CI: domain and integration tests on real local D1/R2, API tests through tRPC and `/mcp`, every Storybook story as a component test with axe accessibility checks as a hard gate, and Playwright journeys against the local app
- Cloudflare D1 + Drizzle, SQL migrations generated by drizzle-kit and applied by Wrangler
- Typed tRPC API plus a minimal REST example
- One Worker for HTTP, the queue consumer and Cron Triggers
- Typed background jobs on Cloudflare Queues: CloudEvents envelopes that carry the caller's trace and user, per-job exponential backoff, idempotency keys in D1, a final-failure report and a dead-letter queue kept 14 days; a cron catalog checked against `wrangler.jsonc`
- R2 two ways: through the Worker with the `FILES` binding, or direct with presigned URLs
- Cloudflare Email Service through the `send_email` binding (simulated in local dev), behind an Email port
- Notifications: a typed catalog, `notify` from any use case, an in-app inbox with an unread badge, per-user preferences per type and channel, email at once or as a daily digest, RFC 8058 one-click unsubscribe, security notices that cannot be turned off, retention, and MCP tools
- Soft delete with a workspace trash: deleted files can be restored for 30 days, owners delete for good sooner, a daily job purges the rest with their R2 objects, a generic trash any table can join, and an architecture test that no live read sees trashed rows; optional storage reconciliation (`STORAGE_RECONCILE=off|report|delete`) reports or removes orphaned R2 objects
- Data exports and account erasure: personal and workspace ZIP exports built by a bounded streaming queue job and downloaded through expiring signed links, self-service and admin account erasure through one pipeline (last-owner and last-admin checks, R2 cleanup including uploads still in flight, audit redaction), and a data catalog that every table must join (enforced in CI)
- Append-only audit log in D1 (sign-in, failed sign-in, sign-up, password reset and change; admin and workspace actions in the catalog): typed actions with strict metadata, the request's trace id on every event, OCSF-aligned fields, daily retention purge, and an architecture test that every state change is audited
- OpenTelemetry-shaped logs and error reports in Workers Logs (exportable over OTLP) behind swappable ports (Logger, ErrorReporter), W3C Trace Context across HTTP and background jobs, and a reference (the trace id) users can quote instead of a stack trace
- Metrics and tracing behind ports shaped on the OpenTelemetry API: a typed metric catalog with semantic-convention names (OpenMetrics when exported), request, procedure, queue and cron latency in Workers Analytics Engine (queryable from Grafana), and spans for every request, procedure, MCP tool, message and cron run on the same trace
- Product analytics shaped like the Segment spec: a typed event catalog per feature (server and client events, no personal-data property names, enforced in CI), written to Workers Analytics Engine under HMAC-pseudonymous user and workspace ids, queried outside the app with SQL or Grafana; optional cookieless Cloudflare Web Analytics beacon
- Feature flags shaped like OpenFeature: a typed catalog in code (owner and removal condition per flag, enforced in CI), workspace, plan and percentage rules stored in D1 behind a swappable port, `useFlag`/`FlagGate` in the SPA, admin procedures and MCP tools
- Component library in Linear's visual language (dark-first, dense, keyboard-first): 60+ components from buttons to data tables, command palette, kanban and app shell, themed by tokens, re-branded in two files
- Storybook built into the web app at `/_storybook/` in every environment
- Cloudflare Container demo, deployed as its own Worker
- Setup scripts (`setup:cloudflare`, `setup:secrets`, `setup:auth`, `setup:admin`, `setup:analytics`, `setup:email`, `setup:storage`, `setup:privacy-storage`, `doctor`), agent skills in `.claude/skills/`, and CI that can run on self-hosted runners in Docker (`runner:up`)
- Every dependency pinned to an exact version

## Starting a new project from this starter

This repository is a template, not a framework. When you start a project from it:

1. **Update and pin every dependency.** The pins here are only as fresh as the last time the starter was touched.

   ```bash
   bun update --latest              # root
   for d in apps/* packages/*; do (cd "$d" && bun update --latest); done
   bun run verify && bun run build
   ```

   [bunfig.toml](bunfig.toml) sets `exact = true`, so updates and new `bun add`s are written without `^`/`~`. Read the changelogs of any major bump. Two known holds: `astro check` needs TypeScript 6 until Astro supports TypeScript 7.1+, so keep `typescript` on the latest 6.x; and any peer ranges in `packages/ui` need bumping by hand.

2. **Choose how users are grouped and who may sign up.** `WORKSPACE_MODE` (personal: everyone works alone; single: one team in one workspace; multi: teams create and join workspaces) and `SIGN_UP` (open or invite-only), per environment with `bun run setup:auth`, which also asks for the sign-in switches and the two-factor and passkey policy ([docs/guides/how-to-configure-account-security.md](docs/guides/how-to-configure-account-security.md)). The starter ships no choice for deployed environments: a deploy refuses to start until you have run it. Replace the placeholder roles (`owner`, `member`) with the product's. [docs/guides/how-to-configure-workspaces.md](docs/guides/how-to-configure-workspaces.md) The same script asks for `BILLING` (off, manual or provider); replace the example plans in `packages/features/src/billing/domain/catalog.ts` (and their names in `apps/web/src/lib/billing-catalog.ts`). [docs/guides/how-to-configure-plans-and-billing.md](docs/guides/how-to-configure-plans-and-billing.md) Decide the same way whether each environment collects product events and Web Analytics: `bun run setup:analytics` ([docs/guides/how-to-setup-product-analytics.md](docs/guides/how-to-setup-product-analytics.md)).

3. **Strip what the product does not use.** Every feature here is a demo of a pattern; keeping unused ones costs bindings, secrets, provisioning and review surface. Typical cuts:

   | Not needed                      | Remove                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
   | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Containers                      | `apps/container`, `docs/guides/how-to-setup-container.md`, `dev:container` script                                                                                                                                                                                                                                                                                                                                                                                                                                   |
   | Storybook                       | `apps/storybook`, the root `storybook`/`build-storybook`/`test:components` scripts, the Storybook step in `apps/web`'s `build`, the CI `components` job                                                                                                                                                                                                                                                                                                                                                             |
   | Background jobs                 | `queue` in `apps/web/src/worker.ts`, `src/server/queue.ts`, `queues` in `wrangler.jsonc`, `packages/features/src/jobs`, `job-catalog.ts`, `greetings`, the `jobs.schema` import in `database.ts`, the queue demo and `queue.enqueueHello`/`enqueue_hello`; the `APP_QUEUE` check and `jobQueue` in `src/server/platform.ts`, `jobQueue` in the tRPC context, `test/architecture/jobs.test.ts`, the `no-direct-queue-send` override in `biome.json`. Cron entries enqueue jobs: keep jobs if you keep scheduled work |
   | Scheduled work                  | `scheduled` in `src/worker.ts`, `src/server/cron.ts`, `packages/features/src/cron-catalog.ts`, `triggers` in `wrangler.jsonc`                                                                                                                                                                                                                                                                                                                                                                                       |
   | Placeholder apps (Notes, Tasks) | the steps in [how-to-add-a-feature.md](docs/guides/how-to-add-a-feature.md#removing-notes-from-a-project); Tasks is one page and one component (`TaskBoard`)                                                                                                                                                                                                                                                                                                                                                        |
   | File storage                    | `packages/features/src/files` (feature, table), `r2_buckets`, `/api/files`, the upload demo and its E2E journey (`apps/web/test/e2e/upload.spec.ts`); or keep only one of the two R2 paths                                                                                                                                                                                                                                                                                                                          |
   | Email                           | the Email port and its adapters (`packages/features/src/platform/ports/email.ts`, `adapters/*/…-email.ts`), `send_email` and `EMAIL_FROM*` in `wrangler.jsonc`, the email demo; auth links then go to the dev log locally (APP_ENV=local), and deployed, password reset and verification answer 412                                                                                                                                                                                                                 |
   | Notifications                   | `packages/features/src/notifications`, `notification-catalog.ts` and the `*Notification` definitions with their `notify` calls (workspaces, accounts, privacy, admin, `server/auth-audit.ts`, `server/auth-security.ts`), its jobs in `job-catalog.ts` and cron entries, `RL_UNSUBSCRIBE`, `api/notifications/unsubscribe.ts`, `unsubscribe.astro`, the bell in `AppLayout` and the notification pages, the notification components in `packages/ui`, the tools in `mcp/tools.ts`, the notification E2E steps       |
   | Google sign-in                  | `GOOGLE_*` values and `GoogleSignInButton`                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
   | Storage reconciliation          | Nothing to remove: set `STORAGE_RECONCILE=off` (shipped everywhere but the starter's production), and the daily entry enqueues nothing; admins can still run a report                                                                                                                                                                                                                                                                                                                                               |
| Demo mode (the starter's public demo) | Keep `DEMO_MODE=off` (it is off everywhere but the starter's own staging and production), or delete it: the list in [how-to-run-a-public-demo.md](docs/guides/how-to-run-a-public-demo.md#removing-demo-mode); no table belongs to it |
| Plans and billing | Choose `BILLING=off` (everything unlimited, no billing queries) rather than removing it: every gated use case calls `deps.billing` |
| Two-factor, passkeys, settings, trash, privacy | Not meant to be removed: they are wired into the auth hooks, the erasure pipeline and the data catalog. Turn two-factor or passkeys off with `TWO_FACTOR=off` and `PASSKEYS=off` |

Removing background jobs, file storage or email also removes its readiness check (`queue:binding`, `r2:responseTime`, `email:configuration`) from `readinessProbes` in `apps/web/src/server/health.ts` and from `CHECKS` in `apps/web/test/api/health.test.ts`; otherwise `/health/ready` answers 503 (or warns, for email) for good.

Keep MCP: it is how agents use the product. When you delete an API, delete its tool; the parity test tells you.

If the web Worker ends up with only `fetch`, point `main` in `apps/web/wrangler.jsonc` back at the adapter's default entry or keep `src/worker.ts` with `fetch` alone. Then remove the demo pages and rename `cloudflare-starter-*` resources.

4. **Decide what the starter's own pages become.** The landing page at `/` and the docs site at `/docs` describe the starter. Replace the landing with the product's (copy in `apps/web/src/landing/content.ts`, sections in `apps/web/src/pages/index.astro`), and either keep publishing the repository's docs (the guides then serve the project's developers), turn `/docs` into product docs by pointing `DOCS.sources` at them, or remove it. Steps for each: [docs/guides/how-to-publish-docs-and-landing.md](docs/guides/how-to-publish-docs-and-landing.md#replace-the-landing-page). Set the production `SITE_URL` in `apps/web/package.json` (`deploy:production`) to the project's domain.

5. **Give the project its own rate-limit namespace block, domain and sender.** Workers Rate Limiting `namespace_id`s are account-wide: a project that keeps the starter's ids (7001–7013, 8001–8013, 9001–9013) shares its limits with every other project in the account that did. After renaming the Worker, `bun run setup:cloudflare --env all --dry-run` shows the block it will assign (from a hash of the Worker name, or `--namespace-base <n>`), and the same command without `--dry-run` writes it; `bun run doctor` fails until then ([docs/guides/how-to-configure-abuse-protection.md](docs/guides/how-to-configure-abuse-protection.md#namespace-ids)). Replace the starter's production hostname in `routes` (`starter.flooper.me`) with the project's, and pick its `EMAIL_FROM` ([docs/guides/how-to-setup-web-app.md](docs/guides/how-to-setup-web-app.md#deploy)).

## Workspace

Apps:

| Path                                       | Description                                                                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| [apps/web](apps/web/README.md)             | The main Worker: Astro site + `/app/*` SPA, Better Auth, D1, R2, email, tRPC + REST, MCP, queue consumer, Cron Triggers |
| [apps/container](apps/container/README.md) | Cloudflare Container demo (Dockerized pi), its own Worker                                                               |
| [apps/storybook](apps/storybook/README.md) | Storybook config; built into the web app at `/_storybook/`                                                              |

Packages:

| Path                                             | Description                                                                   |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| [packages/features](packages/features/README.md) | Server feature code: use cases, domain rules, tables, ports and adapters      |
| [packages/ui](packages/ui/README.md)             | Component library: tokens, brand, components, app patterns, Storybook stories |

## Working on this repo (people and agents)

[AGENTS.md](AGENTS.md) points agents to the [documentation index](docs/README.md). The [development process](docs/processes/development.md) covers how work is done; [architecture principles](docs/architecture/overview.md#principles) define the system's contracts, including MCP coverage for APIs ([MCP guide](docs/guides/how-to-setup-mcp.md)). Agents also get skills for setting up auth, D1 and email in [.claude/skills](.claude/skills).

## Why one Worker

Queue consumer and Cron Triggers run in the web Worker ([apps/web/src/worker.ts](apps/web/src/worker.ts)). They share its bindings (D1, R2, secrets) without wiring them twice, and they deploy together with the code that produces their work, so producer and consumer never drift. Split a handler into its own Worker only when it needs separate scaling, limits or deploys. The Container stays separate because its Docker image is built on every deploy of its Worker.

## Requirements

- Bun `1.3+`
- Node `24.14.1+` (`.nvmrc`): Astro's CLI runs on Node
- Cloudflare account; Workers Paid for Containers and for the 14-day dead-letter queue retention (on Workers Free `setup:cloudflare` warns and keeps the 24-hour retention)
- Docker Desktop (or compatible) for the container demo only
- Workers Paid and a sender domain on Cloudflare for real email in deployed environments
- Optional: R2 API token (presigned path), Google OAuth client

## Install and first run

```bash
bun install
cp apps/web/.dev.vars.example apps/web/.dev.vars   # or: bun run setup:secrets
bun run db:migrate:local
bun run doctor
bun run dev:web
```

Open `APP_URL` from `apps/web/.dev.vars` (`http://localhost:4321` by default; the dev server listens on its port) and create an account at `/sign-up`. D1, R2 (binding), email, the queue and cron all run locally inside Wrangler; nothing else to start. Mail is logged by the dev server instead of sent. Trigger a cron schedule with `curl "http://localhost:4321/cdn-cgi/local/scheduled?cron=17+3+*+*+*"`.

## Environment

Config lives in `wrangler.jsonc` per app (the format Cloudflare recommends; some newer Wrangler features are JSON-only). Bindings and vars are declared per environment there (`develop` at the top level, `env.staging`, `env.production`); bindings are not inherited between environments.

Secrets for the web app come from `apps/web/.dev.vars` locally and Worker secrets when deployed (`bun run setup:secrets`). It boots with `APP_URL` and `BETTER_AUTH_SECRET`; Google and R2 keys are optional. Sign-in methods (`AUTH_EMAIL_PASSWORD`, `AUTH_REQUIRE_EMAIL_VERIFICATION`, required), the email sender, and the workspace, billing and account-security settings (`WORKSPACE_MODE`, `SIGN_UP`, `BILLING`, `TWO_FACTOR`, `PASSKEYS`, required) are plain vars in `wrangler.jsonc`. See [apps/web/.dev.vars.example](apps/web/.dev.vars.example).

## Scripts

| Command                                  | What it does                                                                                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run dev`                            | Starts web + container in parallel                                                                                                                                  |
| `bun run dev:web`                        | Starts the web Worker (Astro dev, with D1, R2, queue and cron simulated)                                                                                            |
| `bun run dev:container`                  | Starts the Container pi demo                                                                                                                                        |
| `bun run storybook`                      | Starts Storybook on port `6006`                                                                                                                                     |
| `bun run build-storybook`                | Builds Storybook into `apps/web/public/_storybook`                                                                                                                  |
| `bun run build`                          | Builds every deployable app workspace                                                                                                                               |
| `bun run verify`                         | Typecheck + Biome lint + Vitest                                                                                                                                     |
| `bun run test`                           | All tests: unit (Node) and integration/API on real local D1 in workerd                                                                                              |
| `bun run test:unit` / `test:integration` | One layer only                                                                                                                                                      |
| `bun run test:components`                | Every Storybook story in Chromium, dark and light theme: renders, passes axe, runs its `play` interaction test                                                      |
| `bun run test:e2e`                       | Playwright journeys ([the list](docs/architecture/testing.md#layers)) against `astro dev`; needs `.dev.vars` and `db:migrate:local`                                 |
| `bun run test:e2e:build`                 | The built app's security headers and CSP in Chromium against `astro preview`; run after `bun run build`                                                             |
| `bun run test:smoke -- --base-url <url>` | Read-only production smoke suite against a deployed app (`--env production` reads the URL from `wrangler.jsonc`)                                                    |
| `bun run db:generate`                    | Generates a SQL migration from the Drizzle schema                                                                                                                   |
| `bun run db:migrate:local`               | Applies pending migrations to the local D1 database                                                                                                                 |
| `bun run doctor`                         | Checks the local setup and each environment's config, changes nothing                                                                                               |
| `bun run setup:cloudflare`               | Creates D1, R2, queues for an environment, writes the D1 id, R2 jurisdiction and rate-limit namespace_ids into the config                                           |
| `bun run setup:secrets`                  | Asks for secrets; writes `.dev.vars` or sets Worker secrets                                                                                                         |
| `bun run setup:email`                    | Enables Email Sending for a domain and writes the sender into the config                                                                                            |
| `bun run setup:auth`                     | Asks for the sign-in switches, two-factor and passkey policy, workspace mode, sign-up policy, billing mode and `ADMIN_PORTAL` and writes them into `wrangler.jsonc` |
| `bun run setup:admin --email <address>`  | Makes an account a platform admin (`--demote` reverses, `--remote --env <env>` for a deployed database), audited                                                    |
| `bun run setup:analytics`                | Asks whether an environment collects product events and Web Analytics and writes the settings into `wrangler.jsonc`                                                 |
| `bun run setup:storage`                  | Writes `STORAGE_RECONCILE` (off, report or delete) into `wrangler.jsonc` ([trash guide](docs/guides/how-to-use-trash.md#optional-storage-reconciliation))           |
| `bun run setup:privacy-storage`          | Adds the R2 lifecycle rule that expires data-export archives ([privacy guide](docs/guides/how-to-handle-data-privacy.md#storage-expiry-setup))                      |
| `bun run runner:up -- --workers <n>`     | Builds and starts n self-hosted CI runners in Docker ([how-to-setup-ci.md](docs/guides/how-to-setup-ci.md#self-hosted-runners))                                     |
| `bun run runner:down` / `runner:logs`    | Stops the runners / follows their logs                                                                                                                              |
| `bun run runner:remove -- --all`         | Unregisters the runners and deletes their containers and volumes                                                                                                    |

In `apps/web`: `deploy`, `deploy:staging`, `deploy:production`, `deploy:dry-run` (build + `wrangler deploy --dry-run`, also run per environment by CI), `db:migrate:remote`.

## Deployment

The web Worker's environment is chosen at **build** time with `CLOUDFLARE_ENV`; `wrangler deploy --env` does not retarget an already built bundle. The `deploy:*` scripts do both steps:

```bash
cd apps/web
bunx wrangler d1 migrations apply DB --remote --env production
bun run deploy:production
```

See [docs/guides/how-to-setup-web-app.md](docs/guides/how-to-setup-web-app.md) for first-time provisioning. CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs `verify`, checks migrations against the schema and that they apply, and builds.

## Docs

The [documentation index](docs/README.md) lists every guide, the architecture docs and the processes, each with when to read it.
