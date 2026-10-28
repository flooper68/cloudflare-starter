# @cloudflare-starter/web

The main Worker: Astro 7 + React 19 serving the public SSR surface and the Better Auth–protected React SPA under `/app/*`, plus the queue consumer and Cron Triggers ([src/worker.ts](src/worker.ts)). Data, users and sessions live in D1; files in R2.

See [docs/guides/how-to-setup-web-app.md](../../docs/guides/how-to-setup-web-app.md) for setup and deployment.

Related guides:

- [docs/guides/how-to-setup-auth.md](../../docs/guides/how-to-setup-auth.md) — Better Auth, optional Google sign-in
- [docs/guides/how-to-setup-d1.md](../../docs/guides/how-to-setup-d1.md) — D1 database and migrations
- [docs/guides/how-to-setup-r2.md](../../docs/guides/how-to-setup-r2.md) — R2 binding and presigned URLs
- [docs/guides/how-to-setup-email.md](../../docs/guides/how-to-setup-email.md) — Cloudflare Email Service
- [docs/guides/how-to-setup-mcp.md](../../docs/guides/how-to-setup-mcp.md) — the MCP server and its parity rule
- [docs/guides/how-to-setup-logging.md](../../docs/guides/how-to-setup-logging.md) — structured logs, request ids, `LOG_SINK`
- [docs/guides/how-to-setup-error-reporting.md](../../docs/guides/how-to-setup-error-reporting.md) — error reports and references, `ERROR_REPORTER`

Every on-demand request gets a request context in [src/middleware.ts](src/middleware.ts) (an `x-request-id` on each response); the logger and error reporter are picked in [src/server/platform.ts](src/server/platform.ts).

## Route layout

Public, SSR:

- `/`, `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/consent`
- `/api/hello` (REST example)
- `/api/trpc/*` (typed API)
- `/api/auth/*` (Better Auth) and `/.well-known/*` (OAuth discovery)
- `/mcp` (MCP server, OAuth bearer tokens)
- `/api/files`, `/api/files/:id` (R2 binding upload and download)

Authenticated, client-routed SPA (`src/pages/app/[...path].astro`):

- `/app/dashboard`, `/app/profile`
- `/app/upload-demo`, `/app/queue-demo`, `/app/email-demo`

Direct loads to `/app/*` hit Astro and middleware first; subsequent navigation stays inside the SPA.

## Develop

```bash
cp .dev.vars.example .dev.vars   # first time
bun run db:migrate:local
bun run dev:web
```

## Test

```bash
bun run test --project web-api   # API tests in workerd (from the repo root)
bun run test:e2e                 # Playwright journeys in test/e2e against astro dev
```

The E2E run needs the same `.dev.vars` and migrated local D1 as `dev:web`, and Chromium once (`bunx playwright install chromium` in `apps/web`). Playwright starts and stops the dev server itself. See [docs/architecture/testing.md](../../docs/architecture/testing.md#e2e-tests).

## Deploy

```bash
cd apps/web
bunx wrangler d1 migrations apply DB --remote --env staging
bun run deploy:staging
```

The environment is chosen at build time (`CLOUDFLARE_ENV`), which the `deploy:*` scripts set. Bindings: `DB` (D1), `FILES` (R2), `EMAIL` (send_email), `APP_QUEUE` (producer and consumer), Cron Triggers, plus plain vars. Secrets match [`.dev.vars.example`](.dev.vars.example).
