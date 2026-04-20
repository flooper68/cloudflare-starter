# How To Setup And Deploy The Web App

This guide explains how to run and deploy the Astro web app in this repo.

The web app lives in [apps/web](/Users/premylsciompa/dev_personal/cloudflare-starter/apps/web). It uses the Cloudflare Astro adapter, Clerk authentication, Astro SSR for public and auth pages, a React SPA mounted at `/app/*` for authenticated pages, a Postgres database, typed tRPC routes, and optional queue, R2, and Mailjet integrations.

## What You Need

Before you start:

1. Install Bun.
2. Have a Cloudflare account.
3. Be able to log in with Wrangler.
4. Have a Clerk application.
5. Have a database connection string for `DATABASE_URL`.

Optional dependencies:

- Cloudflare Queues if you want `/app/queue-demo`
- R2 credentials if you want `/app/upload-demo`
- Mailjet credentials if you want `/app/email-demo`

Official references:

- [Astro on Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/)
- [Cloudflare Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Cloudflare Queues getting started](https://developers.cloudflare.com/queues/get-started/)

## Step 1: Install Dependencies

From the repo root:

```bash
cd /Users/premylsciompa/dev_personal/cloudflare-starter
bun install
```

## Step 2: Prepare Your Required Runtime Values

The web app requires these values:

- `APP_URL`
- `DATABASE_URL`
- `PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

Optional values:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_FILES_BUCKET_NAME`
- `MAILJET_API_KEY`
- `MAILJET_SECRET_KEY`
- `MAILJET_FROM_EMAIL`
- `MAILJET_FROM_NAME`
- `MAILJET_SANDBOX`

The current schema is defined here:

- [apps/web/astro.config.mjs](/Users/premylsciompa/dev_personal/cloudflare-starter/apps/web/astro.config.mjs)
- [apps/web/src/lib/config.ts](/Users/premylsciompa/dev_personal/cloudflare-starter/apps/web/src/lib/config.ts)

## Step 3: Authenticate Wrangler

If you are not already logged in:

```bash
bunx wrangler login
```

Optional check:

```bash
bunx wrangler whoami
```

## Step 4: Create Queue Resources If You Want The Queue Demo

If you want `/app/queue-demo` to work in deployed environments, create these queues once:

```bash
bunx wrangler queues create cloudflare-starter-develop
bunx wrangler queues create cloudflare-starter-staging
bunx wrangler queues create cloudflare-starter-production
```

If you do not plan to use the queue feature, you can still deploy the web app, but queue-related flows will fail when used.

## Step 5: Set Local Environment Values

For local development, copy the example file:

```bash
cp .env.example .env
```

Then fill in at least:

- `APP_URL`
- `DATABASE_URL`
- `PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

## Step 6: Test It Locally

From the repo root:

```bash
bun run dev:web
```

Basic verification:

1. Open `http://localhost:4321`
2. Open `/api/hello`
3. Confirm you get a JSON hello response

If you also configured the optional integrations:

- `/app/queue-demo` tests queue publishing
- `/app/upload-demo` tests R2 upload flow
- `/app/email-demo` tests Mailjet sending

## Step 7: Set Secrets For The Deployed Worker

Deploy the required secrets to the web worker.

From [apps/web](/Users/premylsciompa/dev_personal/cloudflare-starter/apps/web):

```bash
cd /Users/premylsciompa/dev_personal/cloudflare-starter/apps/web
bunx wrangler secret put APP_URL
bunx wrangler secret put DATABASE_URL
bunx wrangler secret put PUBLIC_CLERK_PUBLISHABLE_KEY
bunx wrangler secret put CLERK_SECRET_KEY
```

If you want the optional integrations, also set:

```bash
bunx wrangler secret put R2_ACCOUNT_ID
bunx wrangler secret put R2_ACCESS_KEY_ID
bunx wrangler secret put R2_SECRET_ACCESS_KEY
bunx wrangler secret put R2_FILES_BUCKET_NAME
bunx wrangler secret put MAILJET_API_KEY
bunx wrangler secret put MAILJET_SECRET_KEY
bunx wrangler secret put MAILJET_FROM_EMAIL
bunx wrangler secret put MAILJET_FROM_NAME
bunx wrangler secret put MAILJET_SANDBOX
```

For staging:

```bash
bunx wrangler secret put APP_URL --env staging
bunx wrangler secret put DATABASE_URL --env staging
bunx wrangler secret put PUBLIC_CLERK_PUBLISHABLE_KEY --env staging
bunx wrangler secret put CLERK_SECRET_KEY --env staging
```

For production:

```bash
bunx wrangler secret put APP_URL --env production
bunx wrangler secret put DATABASE_URL --env production
bunx wrangler secret put PUBLIC_CLERK_PUBLISHABLE_KEY --env production
bunx wrangler secret put CLERK_SECRET_KEY --env production
```

Important:

- `APP_ENV` is already provided by `wrangler.toml` vars.
- The queue binding is also configured in `wrangler.toml`.
- Secrets must be set before deploy if the app depends on them at runtime.

## Step 8: Build The Web App

The app must be built before deployment because Wrangler serves the built assets from `dist`.

From [apps/web](/Users/premylsciompa/dev_personal/cloudflare-starter/apps/web):

```bash
cd /Users/premylsciompa/dev_personal/cloudflare-starter/apps/web
bun run build
```

This builds the Astro app into `dist`.

Storybook is no longer part of the main web worker build. See [docs/how-to-setup-storybook-worker.md](/Users/premylsciompa/dev_personal/cloudflare-starter/docs/how-to-setup-storybook-worker.md) for the separate Storybook deploy.

## Step 9: Deploy The Web App

Deploy the default environment:

```bash
bunx wrangler deploy
```

Deploy staging:

```bash
bunx wrangler deploy --env staging
```

Deploy production:

```bash
bunx wrangler deploy --env production
```

## Step 10: Verify The Deployment

Use the URL printed by Wrangler after deploy.

Basic verification:

```bash
curl 'https://<your-worker-url>/api/hello'
```

If deployment is healthy, you should get a JSON hello response.

Additional verification:

1. Open the homepage.
2. Test sign-in and sign-up.
3. Confirm signed-in visits to `/` land on `/app/dashboard`.
4. If queue is configured, test `/app/queue-demo`.
5. If R2 is configured, test `/app/upload-demo`.
6. If Mailjet is configured, test `/app/email-demo`.

## Step 11: Deploy Future Changes

Whenever you change the web app:

```bash
cd /Users/premylsciompa/dev_personal/cloudflare-starter/apps/web
bun run build
bunx wrangler deploy
```

For staging or production:

```bash
bunx wrangler deploy --env staging
bunx wrangler deploy --env production
```

## Common Problems

### The Worker Deploys But Crashes At Runtime

Symptom:

- The deploy succeeds, but requests fail in production.

Fix:

- Make sure the required secrets were set on the deployed worker.
- Re-check `APP_URL`, `DATABASE_URL`, `PUBLIC_CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY`.

### Queue Demo Fails

Symptom:

- `/app/queue-demo` reports that the queue is not configured or messages do not get consumed.

Fix:

- Create the queue resources.
- Deploy the queue worker.
- Make sure the web app and queue worker are using matching environments.

### Upload Or Email Demos Fail

Symptom:

- `/app/upload-demo` or `/app/email-demo` returns a configuration error.

Fix:

- Those features are optional and require their own secrets.
- Add the missing R2 or Mailjet values and redeploy if needed.

### You Deployed Without Building

Symptom:

- Asset output is stale or missing.

Fix:

- Run `bun run build` from `apps/web` before `wrangler deploy`.

## Quick Deploy Checklist

1. `bun install`
2. `bunx wrangler login`
3. Create queues if you want `/app/queue-demo`
4. Fill `.env` for local testing
5. `bun run dev:web`
6. `cd apps/web`
7. `bunx wrangler secret put APP_URL`
8. `bunx wrangler secret put DATABASE_URL`
9. `bunx wrangler secret put PUBLIC_CLERK_PUBLISHABLE_KEY`
10. `bunx wrangler secret put CLERK_SECRET_KEY`
11. `bun run build`
12. `bunx wrangler deploy`
