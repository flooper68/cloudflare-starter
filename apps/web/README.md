# @cloudflare-starter/web

The main Worker: Astro 7 + React 19 serving the public SSR surface and the Better Auth–protected React SPA under `/app/*`, plus the queue consumer and Cron Triggers ([src/worker.ts](src/worker.ts)). Data, users and sessions live in D1; files in R2.

See [docs/how-to-setup-web-app.md](../../docs/how-to-setup-web-app.md) for setup and deployment.

Related guides:

- [docs/how-to-setup-auth.md](../../docs/how-to-setup-auth.md) — Better Auth, optional Google sign-in
- [docs/how-to-setup-d1.md](../../docs/how-to-setup-d1.md) — D1 database and migrations
- [docs/how-to-setup-r2.md](../../docs/how-to-setup-r2.md) — R2 binding and presigned URLs
- [docs/how-to-setup-mailjet.md](../../docs/how-to-setup-mailjet.md) — Mailjet for `/app/email-demo`

## Route layout

Public, SSR:

- `/`, `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`
- `/api/hello` (REST example)
- `/api/trpc/*` (typed API)
- `/api/auth/*` (Better Auth)
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

## Deploy

```bash
cd apps/web
bunx wrangler d1 migrations apply DB --remote --env staging
bun run deploy:staging
```

The environment is chosen at build time (`CLOUDFLARE_ENV`), which the `deploy:*` scripts set. Bindings: `DB` (D1), `FILES` (R2), `APP_QUEUE` (producer and consumer), Cron Triggers, `APP_ENV`. Secrets match [`.dev.vars.example`](.dev.vars.example).
