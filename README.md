# Cloudflare Starter

A Bun monorepo for building Cloudflare-first products: an Astro web app with a Clerk-protected React SPA, a shared feature package for database and services, and dedicated workers for queues, schedules, and containers.

## Highlights

- Astro 6 + React 19 web app on Cloudflare Workers, with SSR public pages and a client-routed SPA under `/app/*`
- Clerk authentication across the SPA surface
- Typed tRPC API plus a minimal REST example
- Drizzle + Postgres with committed SQL migrations
- Optional R2 upload demo and Mailjet email demo, both gated by env
- Dedicated workers for queue consumption, cron, and a Cloudflare Container pi demo
- Standalone Storybook worker, deployable behind Cloudflare Access

## Workspace

Apps:

| Path | Description |
| --- | --- |
| [apps/web](apps/web/README.md) | Astro web app + `/app/*` React SPA, Clerk auth, tRPC + REST endpoints |
| [apps/queue-worker](apps/queue-worker/README.md) | Cloudflare Queue consumer |
| [apps/cron-worker](apps/cron-worker/README.md) | Cloudflare Cron worker |
| [apps/container](apps/container/README.md) | Cloudflare Container demo (Dockerized pi) |
| [apps/storybook](apps/storybook/README.md) | Standalone Storybook deploy target |

Packages:

| Path | Description |
| --- | --- |
| [packages/features](packages/features/README.md) | Shared feature code: db, email, queue, storage |
| [packages/ui](packages/ui/README.md) | Shared UI primitives and global styles |

## Requirements

- Bun `1.3+`
- Docker Desktop (or compatible runtime) for local Postgres and the container demo
- Clerk application credentials
- Cloudflare account for Workers and Queues
- Workers Paid plan for the Container demo
- Optional: R2 bucket, Mailjet account

## Install

```bash
bun install
cp .env.example .env
```

## Environment

The app boots with only the core variables populated. R2 and Mailjet blocks are optional and only required for the `/app/upload-demo` and `/app/email-demo` routes. Sections and requirements are documented inline in [.env.example](.env.example).

Each entrypoint app owns and validates its own runtime config; shared packages stay config-agnostic. `APP_ENV` is optional locally and set by Wrangler (`develop` | `staging` | `production`) in deployed environments.

## First run

1. Start Postgres: `bun run db:up`
2. Apply migrations: `bun run db:migrate`
3. Start the web app: `bun run dev:web`
4. Optional, in separate terminals: `bun run dev:queue`, `bun run dev:cron`, `bun run dev:container`
5. Open `http://localhost:4321` and sign in with Clerk to reach `/app/*`

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Starts web + queue + cron + container in parallel |
| `bun run dev:web` | Starts the Astro web app |
| `bun run dev:queue` | Starts the queue worker with Wrangler |
| `bun run dev:cron` | Starts the cron worker with scheduled-event testing |
| `bun run dev:container` | Starts the Container pi demo with Wrangler |
| `bun run storybook` | Starts Storybook on port `6006` |
| `bun run build-storybook` | Builds the static Storybook bundle |
| `bun run deploy:storybook` | Builds and deploys the Storybook worker |
| `bun run build` | Builds every deployable app workspace |
| `bun run verify` | Runs typecheck + Biome lint + Vitest |
| `bun run test` | Runs Vitest once |
| `bun run db:up` | Starts local Postgres via Docker |
| `bun run db:down` | Stops local Postgres |
| `bun run db:new` | Scaffolds a new SQL migration |
| `bun run db:migrate` | Applies pending migrations |

## Docs

- [How to setup the web app](docs/how-to-setup-web-app.md)
- [How to setup the queue worker](docs/how-to-setup-queue-worker.md)
- [How to setup the cron worker](docs/how-to-setup-cron-worker.md)
- [How to setup the container demo](docs/how-to-setup-container.md)
- [How to setup the Storybook worker](docs/how-to-setup-storybook-worker.md)
- [How to setup R2 for the upload demo](docs/how-to-setup-r2.md)
- [How to setup Mailjet for the email demo](docs/how-to-setup-mailjet.md)

## Deployment

Each app deploys independently with Wrangler. See the individual app README and its setup doc for environment bindings, secrets, and the exact `wrangler deploy` invocation.
