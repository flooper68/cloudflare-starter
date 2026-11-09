# Start a project

How to start your own app from the starter, what is in the repository, and the commands to run, build and deploy it. The [README](../../README.md) is the short tour; the [documentation index](../README.md) lists every guide.

## Starting a new project from this starter

Open a coding agent (Claude Code or similar) in an empty folder and paste this prompt, with your app's name for `<name>`:

```text
Create a new agent-native app called <name> from the template https://github.com/flooper68/cloudflare-starter. Read its AGENTS.md first, then follow its start-project skill (.claude/skills/start-project/SKILL.md). Ask me for each decision it needs, and before every change to my GitHub or Cloudflare account.
```

The agent creates your repository from the template, strips what exists only for the starter's own instance (`bun run starter:strip`), brands the app, runs the setup scripts and deploys it, asking you for each decision and before every account change. What it does and what the strip removes: [docs/guides/how-to-start-a-project.md](../guides/how-to-start-a-project.md).

<details>
<summary>Doing it by hand</summary>

This repository is a template, not a framework. The guide above walks the whole path; beyond the strip, when you start a project from it:

1. **Update and pin every dependency.** The pins here are only as fresh as the last time the starter was touched.

   ```bash
   bun update --latest              # root
   for d in apps/* packages/*; do (cd "$d" && bun update --latest); done
   bun run verify && bun run build
   ```

   [bunfig.toml](../../bunfig.toml) sets `exact = true`, so updates and new `bun add`s are written without `^`/`~`. Read the changelogs of any major bump. Two known holds: `astro check` needs TypeScript 6 until Astro supports TypeScript 7.1+, so keep `typescript` on the latest 6.x; and any peer ranges in `packages/ui` need bumping by hand.

2. **Choose how users are grouped and who may sign up.** `WORKSPACE_MODE` (personal: everyone works alone; single: one team in one workspace; multi: teams create and join workspaces) and `SIGN_UP` (open or invite-only), per environment with `bun run setup:auth`, which also asks for the sign-in switches and the two-factor and passkey policy ([docs/guides/how-to-configure-account-security.md](../guides/how-to-configure-account-security.md)). The starter ships no choice for deployed environments: a deploy refuses to start until you have run it. Replace the placeholder roles (`owner`, `member`) with the product's. [docs/guides/how-to-configure-workspaces.md](../guides/how-to-configure-workspaces.md) The same script asks for `BILLING` (off, manual or provider); replace the example plans in `packages/features/src/billing/domain/catalog.ts` (and their names in `apps/web/src/lib/billing-catalog.ts`). [docs/guides/how-to-configure-plans-and-billing.md](../guides/how-to-configure-plans-and-billing.md) Decide the same way whether each environment collects product events and Web Analytics: `bun run setup:analytics` ([docs/guides/how-to-setup-product-analytics.md](../guides/how-to-setup-product-analytics.md)).

3. **Strip what the product does not use.** Every feature here is a demo of a pattern; keeping unused ones costs bindings, secrets, provisioning and review surface. Typical cuts:

   | Not needed                      | Remove                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
   | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Containers                      | `apps/container`, `docs/guides/how-to-setup-container.md`, `dev:container` script                                                                                                                                                                                                                                                                                                                                                                                                                                   |
   | Storybook                       | `apps/storybook`, the root `storybook`/`build-storybook`/`test:components` scripts, the Storybook step in `apps/web`'s `build`, the CI `components` job                                                                                                                                                                                                                                                                                                                                                             |
   | Background jobs                 | `queue` in `apps/web/src/worker.ts`, `src/server/queue.ts`, `queues` in `wrangler.jsonc`, `packages/features/src/jobs`, `job-catalog.ts`, `greetings`, the `jobs.schema` import in `database.ts`, the queue demo and `queue.enqueueHello`/`enqueue_hello`; the `APP_QUEUE` check and `jobQueue` in `src/server/platform.ts`, `jobQueue` in the tRPC context, `test/architecture/jobs.test.ts`, the `no-direct-queue-send` override in `biome.json`. Cron entries enqueue jobs: keep jobs if you keep scheduled work |
   | Scheduled work                  | `scheduled` in `src/worker.ts`, `src/server/cron.ts`, `packages/features/src/cron-catalog.ts`, `triggers` in `wrangler.jsonc`                                                                                                                                                                                                                                                                                                                                                                                       |
   | Placeholder apps (Notes, Tasks) | the steps in [how-to-add-a-feature.md](../reference/adding-a-feature.md#removing-notes-from-a-project); Tasks is one page and one component (`TaskBoard`)                                                                                                                                                                                                                                                                                                                                                           |
   | File storage                    | `packages/features/src/files` (feature, table), `r2_buckets`, `/api/files`, the upload demo and its E2E journey (`apps/web/test/e2e/upload.spec.ts`); or keep only one of the two R2 paths                                                                                                                                                                                                                                                                                                                          |
   | Email                           | the Email port and its adapters (`packages/features/src/platform/ports/email.ts`, `adapters/*/…-email.ts`), `send_email` and `EMAIL_FROM*` in `wrangler.jsonc`, the email demo; auth links then go to the dev log locally (APP_ENV=local), and deployed, password reset and verification answer 412                                                                                                                                                                                                                 |
   | Notifications                   | `packages/features/src/notifications`, `notification-catalog.ts` and the `*Notification` definitions with their `notify` calls (workspaces, accounts, privacy, admin, `server/auth-audit.ts`, `server/auth-security.ts`), its jobs in `job-catalog.ts` and cron entries, `RL_UNSUBSCRIBE`, `api/notifications/unsubscribe.ts`, `unsubscribe.astro`, the bell in `AppLayout` and the notification pages, the notification components in `packages/ui`, the tools in `mcp/tools.ts`, the notification E2E steps       |
   | Google sign-in                  | `GOOGLE_*` values and `GoogleSignInButton`                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
   | Storage reconciliation          | Nothing to remove: set `STORAGE_RECONCILE=off` (shipped everywhere but the starter's production), and the daily entry enqueues nothing; admins can still run a report                                                                                                                                                                                                                                                                                                                                               |
| Demo mode (the starter's public demo) | Keep `DEMO_MODE=off` (it is off everywhere but the starter's own staging and production), or delete it: the list in [how-to-run-a-public-demo.md](../reference/public-demo.md#removing-demo-mode); no table belongs to it |
| Plans and billing | Choose `BILLING=off` (everything unlimited, no billing queries) rather than removing it: every gated use case calls `deps.billing` |
| Two-factor, passkeys, settings, trash, privacy | Not meant to be removed: they are wired into the auth hooks, the erasure pipeline and the data catalog. Turn two-factor or passkeys off with `TWO_FACTOR=off` and `PASSKEYS=off` |

Removing background jobs, file storage or email also removes its readiness check (`queue:binding`, `r2:responseTime`, `email:configuration`) from `readinessProbes` in `apps/web/src/server/health.ts` and from `CHECKS` in `apps/web/test/api/health.test.ts`; otherwise `/health/ready` answers 503 (or warns, for email) for good.

Keep MCP: it is how agents use the product. When you delete an API, delete its tool; the parity test tells you.

If the web Worker ends up with only `fetch`, point `main` in `apps/web/wrangler.jsonc` back at the adapter's default entry or keep `src/worker.ts` with `fetch` alone. Then remove the demo pages and rename `cloudflare-starter-*` resources.

4. **Decide what the starter's own pages become.** The landing page at `/` and the docs site at `/docs` describe the starter. Replace the landing with the product's (copy in `apps/web/src/landing/content.ts`, sections in `apps/web/src/pages/index.astro`), and either keep publishing the repository's docs (the guides then serve the project's developers), turn `/docs` into product docs by pointing `DOCS.sources` at them, or remove it. Steps for each: [docs/guides/how-to-publish-docs-and-landing.md](../reference/docs-site.md#replace-the-landing-page). Set the production `SITE_URL` in `apps/web/package.json` (`deploy:production`) to the project's domain.

5. **Give the project its own rate-limit namespace block, domain and sender.** Workers Rate Limiting `namespace_id`s are account-wide: a project that keeps the starter's ids (7001–7013, 8001–8013, 9001–9013) shares its limits with every other project in the account that did. After renaming the Worker, `bun run setup:cloudflare --env all --dry-run` shows the block it will assign (from a hash of the Worker name, or `--namespace-base <n>`), and the same command without `--dry-run` writes it; `bun run doctor` fails until then ([docs/guides/how-to-configure-abuse-protection.md](../reference/abuse-protection.md#namespace-ids)). Replace the starter's production hostname in `routes` (`starter.flooper.me`) with the project's, and pick its `EMAIL_FROM` ([docs/start/run-locally.md](../reference/deployment.md#deploy)).

</details>

## Workspace

Apps:

| Path                                             | Description                                                                                                             |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| [apps/web](../../apps/web/README.md)             | The main Worker: Astro site + `/app/*` SPA, Better Auth, D1, R2, email, tRPC + REST, MCP, queue consumer, Cron Triggers |
| [apps/container](../../apps/container/README.md) | Cloudflare Container demo (Dockerized pi), its own Worker                                                               |
| [apps/storybook](../../apps/storybook/README.md) | Storybook config; built into the web app at `/_storybook/`                                                              |

Packages:

| Path                                                   | Description                                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| [packages/features](../../packages/features/README.md) | Server feature code: use cases, domain rules, tables, ports and adapters      |
| [packages/ui](../../packages/ui/README.md)             | Component library: tokens, brand, components, app patterns, Storybook stories |

## Built for coding agents

The repository is set up for coding agents to develop it, not only for an app that agents use. An orchestrator agent leads, implementer subagents build one item each in their own worktree, a `reviewer` subagent checks risky diffs, and CI, the architecture tests and the production smoke and QA suites catch what an agent misses; the owner decides and approves. How it works, with the brief template and what needs the owner's yes: [agentic workflow](../processes/agentic-workflow.md). The skills and subagents in `.claude/`: [catalogue](../processes/agent-skills.md).

## Working on this repo (people and agents)

[AGENTS.md](../../AGENTS.md) points agents to the [documentation index](../README.md). The [development process](../processes/development.md) covers how work is done; [architecture principles](../architecture/overview.md#principles) define the system's contracts, including MCP coverage for APIs ([MCP guide](../guides/how-to-setup-mcp.md)). Agents also get skills for starting a project from the template and for setting up auth, D1 and email in [.claude/skills](../../.claude/skills).

## Why one Worker

Queue consumer and Cron Triggers run in the web Worker ([apps/web/src/worker.ts](../../apps/web/src/worker.ts)). They share its bindings (D1, R2, secrets) without wiring them twice, and they deploy together with the code that produces their work, so producer and consumer never drift. Split a handler into its own Worker only when it needs separate scaling, limits or deploys. The Container stays separate because its Docker image is built on every deploy of its Worker.

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

Secrets for the web app come from `apps/web/.dev.vars` locally and Worker secrets when deployed (`bun run setup:secrets`). It boots with `APP_URL` and `BETTER_AUTH_SECRET`; Google and R2 keys are optional. Sign-in methods (`AUTH_EMAIL_PASSWORD`, `AUTH_REQUIRE_EMAIL_VERIFICATION`, required), the email sender, and the workspace, billing and account-security settings (`WORKSPACE_MODE`, `SIGN_UP`, `BILLING`, `TWO_FACTOR`, `PASSKEYS`, required) are plain vars in `wrangler.jsonc`. See [apps/web/.dev.vars.example](../../apps/web/.dev.vars.example).

## Scripts

| Command                                  | What it does                                                                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run dev`                            | Starts web + container in parallel                                                                                                                                        |
| `bun run dev:web`                        | Starts the web Worker (Astro dev, with D1, R2, queue and cron simulated)                                                                                                  |
| `bun run dev:container`                  | Starts the Container pi demo                                                                                                                                              |
| `bun run storybook`                      | Starts Storybook on port `6006`                                                                                                                                           |
| `bun run build-storybook`                | Builds Storybook into `apps/web/public/_storybook`                                                                                                                        |
| `bun run build`                          | Builds every deployable app workspace                                                                                                                                     |
| `bun run verify`                         | Typecheck + Biome lint + Vitest                                                                                                                                           |
| `bun run test`                           | All tests: unit (Node) and integration/API on real local D1 in workerd                                                                                                    |
| `bun run test:unit` / `test:integration` | One layer only                                                                                                                                                            |
| `bun run test:components`                | Every Storybook story in Chromium, dark and light theme: renders, passes axe, runs its `play` interaction test                                                            |
| `bun run test:e2e`                       | Playwright journeys ([the list](../architecture/testing.md#layers)) against `astro dev`; needs `.dev.vars` and `db:migrate:local`                                         |
| `bun run test:e2e:build`                 | The built app's security headers and CSP in Chromium against `astro preview`; run after `bun run build`                                                                   |
| `bun run test:smoke -- --base-url <url>` | Read-only production smoke suite against a deployed app (`--env production` reads the URL from `wrangler.jsonc`)                                                          |
| `bun run db:generate`                    | Generates a SQL migration from the Drizzle schema                                                                                                                         |
| `bun run db:migrate:local`               | Applies pending migrations to the local D1 database                                                                                                                       |
| `bun run starter:strip`                  | Dry run of removing the starter-only parts (`starter-only.json`) from a new project; `--apply` does it ([how-to-start-a-project.md](../guides/how-to-start-a-project.md)) |
| `bun run doctor`                         | Checks the local setup and each environment's config, changes nothing                                                                                                     |
| `bun run setup:cloudflare`               | Creates D1, R2, queues for an environment, writes the D1 id, R2 jurisdiction and rate-limit namespace_ids into the config                                                 |
| `bun run setup:secrets`                  | Asks for secrets; writes `.dev.vars` or sets Worker secrets                                                                                                               |
| `bun run setup:email`                    | Enables Email Sending for a domain and writes the sender into the config                                                                                                  |
| `bun run setup:auth`                     | Asks for the sign-in switches, two-factor and passkey policy, workspace mode, sign-up policy, billing mode and `ADMIN_PORTAL` and writes them into `wrangler.jsonc`       |
| `bun run setup:admin --email <address>`  | Makes an account a platform admin (`--demote` reverses, `--remote --env <env>` for a deployed database), audited                                                          |
| `bun run setup:analytics`                | Asks whether an environment collects product events and Web Analytics and writes the settings into `wrangler.jsonc`                                                       |
| `bun run setup:storage`                  | Writes `STORAGE_RECONCILE` (off, report or delete) into `wrangler.jsonc` ([trash guide](../reference/trash.md#optional-storage-reconciliation))                           |
| `bun run setup:privacy-storage`          | Adds the R2 lifecycle rule that expires data-export archives ([privacy guide](../reference/data-privacy.md#storage-expiry-setup))                                         |
| `bun run runner:up -- --workers <n>`     | Builds and starts n self-hosted CI runners in Docker ([how-to-setup-ci.md](../reference/ci.md#self-hosted-runners))                                                       |
| `bun run runner:down` / `runner:logs`    | Stops the runners / follows their logs                                                                                                                                    |
| `bun run runner:remove -- --all`         | Unregisters the runners and deletes their containers and volumes                                                                                                          |

In `apps/web`: `deploy`, `deploy:staging`, `deploy:production`, `deploy:dry-run` (build + `wrangler deploy --dry-run`, also run per environment by CI), `db:migrate:remote`.

## Deployment

The web Worker's environment is chosen at **build** time with `CLOUDFLARE_ENV`; `wrangler deploy --env` does not retarget an already built bundle. The `deploy:*` scripts do both steps:

```bash
cd apps/web
bunx wrangler d1 migrations apply DB --remote --env production
bun run deploy:production
```

See [docs/start/run-locally.md](run-locally.md) for first-time provisioning. CI ([.github/workflows/ci.yml](../../.github/workflows/ci.yml)) runs `verify`, checks migrations against the schema and that they apply, and builds.

## Docs

The [documentation index](../README.md) lists every guide, the architecture docs and the processes, each with when to read it.
