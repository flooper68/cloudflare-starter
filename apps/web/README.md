# @cloudflare-starter/web

Astro 6 + React 19 web app deployed to Cloudflare Workers. Serves the public SSR surface and hosts the Clerk-protected React SPA under `/app/*`.

See [docs/how-to-setup-web-app.md](../../docs/how-to-setup-web-app.md) for setup and deployment.

Optional integrations have their own guides:

- [docs/how-to-setup-r2.md](../../docs/how-to-setup-r2.md) — R2 for `/app/upload-demo`
- [docs/how-to-setup-mailjet.md](../../docs/how-to-setup-mailjet.md) — Mailjet for `/app/email-demo`

## Route layout

Public, SSR:

- `/`, `/sign-in`, `/sign-up`, `/forgot-password`
- `/api/hello` (REST example)
- `/api/trpc/*` (typed API)

Authenticated, client-routed SPA (`src/pages/app/[...path].astro`):

- `/app/dashboard`, `/app/profile`
- `/app/upload-demo`, `/app/queue-demo`, `/app/email-demo`

Direct loads to `/app/*` hit Astro and middleware first; subsequent navigation stays inside the SPA.

## Develop

```bash
bun run dev:web
```

## Deploy

```bash
cd apps/web
bun run build
bunx wrangler deploy --env staging
```

Expected bindings: `APP_ENV`, `APP_QUEUE` (producer), optional `HYPERDRIVE`, plus secrets and vars matching [`.env.example`](../../.env.example).
