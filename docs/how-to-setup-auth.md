# How To Setup Authentication (Better Auth)

The web app signs users in with [Better Auth](https://www.better-auth.com). Users, sessions and accounts live in the same D1 database as the app data ([how-to-setup-d1.md](./how-to-setup-d1.md)), so there is no external auth provider to configure for email and password sign-in.

## What Is Wired Up

- Handler: every `/api/auth/*` request goes to Better Auth ([apps/web/src/pages/api/auth/[...all].ts](../apps/web/src/pages/api/auth/[...all].ts)).
- Server config: [apps/web/src/server/auth.ts](../apps/web/src/server/auth.ts) — email and password, optional Google, D1 through the Drizzle adapter, per-route rate limits.
- Middleware: [apps/web/src/middleware.ts](../apps/web/src/middleware.ts) resolves the session cookie into `Astro.locals.user` / `Astro.locals.session` and redirects anonymous `/app/*` requests to `/sign-in`.
- Browser client: [apps/web/src/lib/auth-client.ts](../apps/web/src/lib/auth-client.ts), used by the forms under `src/components/auth/` and `src/components/profile/`.
- tRPC: `protectedProcedure` reads the user from `Astro.locals`, so a signed-out request gets `UNAUTHORIZED`.

Pages:

| Route                     | What it does                                                    |
| ------------------------- | --------------------------------------------------------------- |
| `/sign-up`                | Name, email, password; signs the user in right away             |
| `/sign-in`                | Email and password, plus "Continue with Google" when configured |
| `/forgot-password`        | Sends a reset link                                              |
| `/reset-password?token=…` | Sets a new password and revokes other sessions                  |
| `/app/profile`            | Shows the user, changes the password                            |

## Required Values

In `apps/web/.dev.vars` locally, as Worker secrets when deployed:

```env
APP_URL=http://localhost:4321
BETTER_AUTH_SECRET=<at least 32 characters>
```

Generate a secret per environment:

```bash
openssl rand -base64 32
```

`APP_URL` is the public origin of the app with no trailing slash. Better Auth uses it as its base URL and as the only trusted origin, so it must match the URL in the browser exactly (including the port locally).

Deployed:

```bash
cd apps/web
bunx wrangler secret put APP_URL --env production
bunx wrangler secret put BETTER_AUTH_SECRET --env production
```

Rotating `BETTER_AUTH_SECRET` signs everyone out.

## Password Reset Mail

Reset links go out through the Mailjet service when the `MAILJET_*` values are set ([how-to-setup-mailjet.md](./how-to-setup-mailjet.md)). Without them, the link is printed to the dev server log:

```
[auth] Password reset link for you@example.com: http://localhost:4321/api/auth/reset-password/…
```

That fallback is meant for local development. A deployed environment without Mailjet logs reset links to Workers Logs, so configure Mailjet before you rely on password reset in staging or production.

## Optional: Google Sign-In

1. In Google Cloud Console, create an OAuth client of type "Web application".
2. Add the authorised redirect URIs, one per environment:
   - `http://localhost:4321/api/auth/callback/google`
   - `https://<your-domain>/api/auth/callback/google`
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.dev.vars` and as Worker secrets.

The Google button only renders when both values are present.

## Changing The Auth Schema

The Better Auth tables are hand-maintained in [packages/features/src/db/schema/auth.ts](../packages/features/src/db/schema/auth.ts). When you add a Better Auth plugin that needs tables or columns:

1. Check the plugin's documented schema (or run `bunx @better-auth/cli generate` against a config that mirrors `createAuthOptions`) and add the tables/columns to `auth.ts`.
2. `bun run db:generate` to write the SQL migration.
3. `bun run db:migrate:local`, then apply remotely as in [how-to-setup-d1.md](./how-to-setup-d1.md).

## Not Included Yet

- Email verification on sign-up (Better Auth's `emailVerification` option; needs Mailjet).
- Roles or invite-only sign-up. ServiceHub shows one way: a `role` column on `user` and a `databaseHooks.user.create.before` check.
