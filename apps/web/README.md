# @cloudflare-starter/web

The main Worker: Astro 7 + React 19 serving the public SSR surface and the Better Auth–protected React SPA under `/app/*`, plus the queue consumer and Cron Triggers ([src/worker.ts](src/worker.ts)). Data, users and sessions live in D1; files in R2.

See [docs/guides/how-to-setup-web-app.md](../../docs/guides/how-to-setup-web-app.md) for setup and deployment.

Related guides:

- [docs/guides/how-to-setup-auth.md](../../docs/guides/how-to-setup-auth.md) — Better Auth, optional Google sign-in
- [docs/guides/how-to-configure-workspaces.md](../../docs/guides/how-to-configure-workspaces.md) — workspace modes, sign-up policy, invitations, roles
- [docs/guides/how-to-configure-abuse-protection.md](../../docs/guides/how-to-configure-abuse-protection.md) — rate limits and Turnstile
- [docs/guides/how-to-setup-d1.md](../../docs/guides/how-to-setup-d1.md) — D1 database and migrations
- [docs/guides/how-to-setup-r2.md](../../docs/guides/how-to-setup-r2.md) — R2 binding and presigned URLs
- [docs/guides/how-to-setup-email.md](../../docs/guides/how-to-setup-email.md) — Cloudflare Email Service
- [docs/guides/how-to-setup-mcp.md](../../docs/guides/how-to-setup-mcp.md) — the MCP server and its parity rule
- [docs/guides/how-to-setup-logging.md](../../docs/guides/how-to-setup-logging.md) — OpenTelemetry log records, trace context, `LOG_SINK`
- [docs/guides/how-to-setup-error-reporting.md](../../docs/guides/how-to-setup-error-reporting.md) — error reports and references, `ERROR_REPORTER`
- [docs/guides/how-to-use-feature-flags.md](../../docs/guides/how-to-use-feature-flags.md) — the flag catalog, `useFlag`/`FlagGate` (`src/lib/feature-flags.tsx`), `FEATURE_FLAGS`
- [docs/guides/how-to-setup-metrics-and-tracing.md](../../docs/guides/how-to-setup-metrics-and-tracing.md) — metric catalog, spans, Analytics Engine, `METRICS`, `TRACING`
- [docs/guides/how-to-send-notifications.md](../../docs/guides/how-to-send-notifications.md) — the inbox, bell, notification mail and one-click unsubscribe

Every on-demand request gets a request context in [src/middleware.ts](src/middleware.ts) (`traceparent` and `x-request-id` on each response); the logger, error reporter, metrics and tracer are picked in [src/server/platform.ts](src/server/platform.ts).

## Route layout

Public, SSR:

- `/`, `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/two-factor`, `/consent`
- `/invite/:token` (accept a workspace invitation)
- `/api/hello` (REST example)
- `/api/trpc/*` (typed API)
- `/api/auth/*` (Better Auth) and `/.well-known/*` (OAuth discovery)
- `/mcp` (MCP server, OAuth bearer tokens)
- `/api/files`, `/api/files/:id` (R2 binding upload and download)
- `/api/account/avatar`, `/api/account/avatar/:version` (upload and read the signed-in user's avatar)
- `/api/workspaces/:workspaceId/logo`, `/api/workspaces/:workspaceId/logo/:version` (workspace logo)
- `/api/privacy/exports/:id` (signed, expiring data-export download for the signed-in requester)
- `/api/billing/webhook` (the billing provider's events; 404 unless `BILLING=provider`)
- `/api/notifications/unsubscribe` (RFC 8058 one-click unsubscribe from notification mail) and `/unsubscribe` (its confirmation page)
- `/health/live`, `/health/ready` and `/health` (health endpoints for uptime monitors, `application/health+json`: [how-to-monitor-health.md](../../docs/guides/how-to-monitor-health.md))

Authenticated, client-routed SPA (`src/pages/app/[...path].astro`):

- `/app/dashboard`, `/app/members` (single and multi mode), `/app/billing`, `/app/trash`
- `/app/settings/account`, `/app/settings/appearance`, `/app/settings/security`, `/app/settings/workspace`, `/app/settings/privacy` (`/app/profile` redirects to the first)
- `/app/upload-demo`, `/app/queue-demo`, `/app/email-demo`
- `/app/notifications`, `/app/notifications/preferences` (inbox and notification settings; the bell in the top bar opens the inbox)

Admin portal, same SPA (`src/pages/admin/[...path].astro`, platform admins with `ADMIN_PORTAL=on`, 404 otherwise): `/admin/overview`, `/admin/users`, `/admin/workspaces`, `/admin/audit`, `/admin/flags`, `/admin/data-requests`, `/admin/settings`.

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

The environment is chosen at build time (`CLOUDFLARE_ENV`), which the `deploy:*` scripts set. Bindings: `DB` (D1), `FILES` (R2), `EMAIL` (send_email), `APP_QUEUE` (producer and consumer of background jobs, with a dead-letter queue: [how-to-add-background-jobs.md](../../docs/guides/how-to-add-background-jobs.md)), Cron Triggers, plus plain vars. Secrets match [`.dev.vars.example`](.dev.vars.example).
