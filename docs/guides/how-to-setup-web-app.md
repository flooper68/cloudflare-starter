# How To Setup And Deploy The Web App

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

Bindings come from [apps/web/wrangler.jsonc](../../apps/web/wrangler.jsonc), repeated per environment: `DB` (D1), `FILES` (R2), `EMAIL` (send_email), `APP_QUEUE` (producer, and this Worker is also the consumer), Cron Triggers. Plain vars there: `APP_ENV`, `AUTH_EMAIL_PASSWORD`, `AUTH_REQUIRE_EMAIL_VERIFICATION`, `EMAIL_FROM`, `EMAIL_FROM_NAME`. Code reads them with `import { env } from "cloudflare:workers"`.

Secrets, validated in [apps/web/src/lib/config.ts](../../apps/web/src/lib/config.ts):

| Name                                       | Required | Notes                               |
| ------------------------------------------ | -------- | ----------------------------------- |
| `APP_URL`                                  | yes      | Public origin, no trailing slash    |
| `BETTER_AUTH_SECRET`                       | yes      | 32+ characters, one per environment |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | no       | Enables Google sign-in              |
| `R2_*`                                     | no       | Presigned R2 URLs                   |

`bun run doctor` checks the local setup and points out what is missing for each environment.

## Run Locally

```bash
bun install
cp apps/web/.dev.vars.example apps/web/.dev.vars   # or: bun run setup:secrets
bun run db:migrate:local
bun run doctor
bun run dev:web
```

Open `http://localhost:4321`, create an account at `/sign-up`, and you land on `/app/dashboard`. Blank values in `.dev.vars` count as unset.

Queue and cron run in the same dev server:

- `/app/queue-demo` sends a message; the consumer logs `queue-hello` in the dev output.
- `curl "http://localhost:4321/cdn-cgi/handler/scheduled?cron=*/5+*+*+*+*"` runs the cron handler, which logs `cron-hello`.

## Deploy

Per environment (`develop`, `staging`, `production`); every script takes `--dry-run`.

1. Log in: `bunx wrangler login`.
2. Create D1, R2 and the queues (with dead-letter queues), and write the D1 id into `wrangler.jsonc`:

   ```bash
   bun run setup:cloudflare --env production            # add --jurisdiction eu to keep data in the EU
   ```

3. Email, if the environment sends mail ([how-to-setup-email.md](./how-to-setup-email.md)):

   ```bash
   bun run setup:email --domain example.com --env production
   ```

4. Migrate, build and deploy:

   ```bash
   cd apps/web
   bunx wrangler d1 migrations apply DB --remote --env production
   bun run deploy:production
   ```

5. Secrets (asks for each one, sends them on stdin; this deploys a new version):

   ```bash
   bun run setup:secrets --env production
   ```

   On a brand-new Worker the first deploy answers 500 until the secrets are set a minute later; afterwards secrets persist across deploys.

The environment is picked when building: `deploy:production` runs `CLOUDFLARE_ENV=production bun run build && wrangler deploy`, and `build` builds Storybook into the app first. Running `wrangler deploy --env production` on a bundle built without `CLOUDFLARE_ENV` would deploy the develop config. Use `bun run deploy` for develop and `deploy:staging` for staging. Storybook ships with the app at `/_storybook/` ([how-to-use-storybook.md](./how-to-use-storybook.md)).

## Queues and Cron

- Producer: tRPC `queue.enqueueHello` sends a typed message (the greetings feature's `sendHello`; message types in `packages/features/src/queue-messages.ts`).
- Consumer: [src/server/queue.ts](../../apps/web/src/server/queue.ts). A malformed message is logged and dropped; a failing handler is retried with backoff, and after `max_retries` the message goes to the dead-letter queue.
- Cron: [src/server/cron.ts](../../apps/web/src/server/cron.ts), schedules in `triggers.crons` (UTC). With several schedules, branch on `controller.cron`.
- Logs: `bunx wrangler tail --env production`, or Workers Logs in the dashboard (observability is on).

## Verify

1. `curl https://<your-worker-url>/api/hello` returns a JSON hello.
2. Sign up, sign out, sign in.
3. Signed-in visits to `/` land on `/app/dashboard`; signed-out visits to `/app/*` land on `/sign-in`.
4. Try the demos you configured.

## Common Problems

### Every page returns 500 with a zod error

A required secret is missing or too short. Check `APP_URL` and `BETTER_AUTH_SECRET` (32+ characters) in `.dev.vars` or the Worker secrets.

### `no such table: user`

Migrations were not applied to this database. Run `bun run db:migrate:local`, or the remote command for the environment.

### Sign-in succeeds but you bounce back to `/sign-in`

`APP_URL` does not match the origin in the browser (scheme, host, port), so the cookie or origin check fails.

### Queue demo fails

The queue and its `-dlq` must exist for the environment before deploying; Wrangler refuses to deploy a consumer for a missing queue.

### Upload or email demos fail

The presigned upload and the email demo need their own secrets; the error message names what is missing. The binding upload needs only the bucket.
