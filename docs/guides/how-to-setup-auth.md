# How To Setup Authentication (Better Auth)

The web app signs users in with [Better Auth](https://www.better-auth.com). Users, sessions and accounts live in the same D1 database as the app data ([how-to-setup-d1.md](./how-to-setup-d1.md)), so there is no external auth provider to run. Better Auth is also the OAuth server that MCP clients such as Claude sign in through ([how-to-setup-mcp.md](./how-to-setup-mcp.md)).

## What Is Wired Up

- Handler: every `/api/auth/*` request goes to Better Auth ([pages/api/auth/[...all].ts](../../apps/web/src/pages/api/auth/[...all].ts)).
- Server config: [server/auth.ts](../../apps/web/src/server/auth.ts) — sign-in methods from env flags, D1 through the Drizzle adapter, rate limits stored in D1, the `jwt()` and `mcp()` plugins.
- Middleware: [middleware.ts](../../apps/web/src/middleware.ts) resolves the session cookie into `Astro.locals.user` / `Astro.locals.session` and redirects anonymous `/app/*` requests to `/sign-in`.
- Browser client: [lib/auth-client.ts](../../apps/web/src/lib/auth-client.ts), with the OAuth provider plugin so a sign-in started by an MCP client continues its authorization.
- tRPC: `protectedProcedure` refuses requests without a user (`UNAUTHORIZED`).

Pages:

| Route                     | What it does                                                                  |
| ------------------------- | ----------------------------------------------------------------------------- |
| `/sign-up`                | Name, email, password; signs in right away, or asks to verify the email first |
| `/sign-in`                | The enabled methods: email + password and/or "Continue with Google"           |
| `/forgot-password`        | Sends a reset link (only with email + password on)                            |
| `/reset-password?token=…` | Sets a new password and revokes other sessions                                |
| `/consent`                | Lets the user allow or deny an MCP client                                     |
| `/app/profile`            | Shows the user; changes the password when email + password is on              |

## Secrets

| Name                                       | Notes                                                                                                                                                    |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_URL`                                  | Public origin, no trailing slash. Better Auth's base URL and only trusted origin, so it must match the browser URL exactly (including the port locally). |
| `BETTER_AUTH_SECRET`                       | 32+ characters, one per environment. Rotating it signs everyone out.                                                                                     |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional, see below.                                                                                                                                     |

Set them with the script, which asks for each value (Enter skips; an empty `BETTER_AUTH_SECRET` is generated):

```bash
bun run setup:secrets                      # apps/web/.dev.vars
bun run setup:secrets --env production     # Worker secrets, via wrangler secret bulk on stdin
```

Setting Worker secrets deploys a new version of the Worker.

## Sign-In Methods

Plain vars, per environment in `apps/web/wrangler.jsonc` (`vars`) and in `.dev.vars` locally:

| Var                               | Default | Effect                                                                                                                                                       |
| --------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AUTH_EMAIL_PASSWORD`             | `true`  | Email + password sign-up, sign-in, reset and change password. `false` hides the forms, redirects the password pages to `/sign-in`, and the API refuses them. |
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | `false` | Users must open the verification link before they can sign in. Needs email ([how-to-setup-email.md](./how-to-setup-email.md)).                               |

Google is on when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set. With Google only, `/sign-up` offers just the Google button; the first sign-in creates the account.

At least one method must be on. If none is, or verification is required without email, the app refuses to start with an error naming the setting.

## Auth Mail

Password reset links and verification links go out through Cloudflare Email Service when the environment has email ([how-to-setup-email.md](./how-to-setup-email.md)). Locally the binding is simulated and the dev log shows each message. With email off, the links carry tokens, so what happens depends on `APP_ENV` (`apps/web/src/server/auth-mail.ts`):

- `APP_ENV=local` (set in `.dev.vars`, local development only): the link is logged (record body `auth.mail_not_sent`, attribute `app.auth.link`, through the Logger, so with `LOG_SINK=none` it goes nowhere).
- Any other value, or unset (every deployed environment): no link is logged. `/request-password-reset` and `/send-verification-email` answer 412 with code `EMAIL_NOT_CONFIGURED` ("Email is not configured for this environment …") for every address, so the response does not reveal which emails are registered. An error-level `auth.mail_not_sent` line without link or recipient is logged if a link is attempted elsewhere. Set up email ([how-to-setup-email.md](./how-to-setup-email.md)) before offering password reset in a deployed environment.

When email is on, a verification mail is sent on sign-up even if verification is not required, so `emailVerified` becomes true once the user clicks it.

## Optional: Google Sign-In

1. In Google Cloud Console, create an OAuth client of type "Web application".
2. Add the authorised redirect URIs, one per environment:
   - `http://localhost:4321/api/auth/callback/google`
   - `https://<your-domain>/api/auth/callback/google`
3. `bun run setup:secrets` (and `--env <env>`) and enter the client id and secret.

## Changing The Auth Tables

[packages/features/src/accounts/accounts.schema.ts](../../packages/features/src/accounts/accounts.schema.ts) is generated by the Better Auth CLI from the real auth config (core tables, JWT keys, OAuth clients/tokens/consents, rate limits). Regenerate it after upgrading Better Auth or changing plugins:

```bash
cd apps/web
bunx auth@<better-auth version> generate --config scripts/auth-schema.config.ts \
  --output ../../packages/features/src/accounts/accounts.schema.generated.ts --yes
```

Replace `accounts.schema.ts` with the result (keep its header comment), delete `accounts.schema.generated.ts`, then `bun run db:generate` and review the SQL. To add app columns to `user`, use Better Auth's `user.additionalFields` in `server/auth.ts` and regenerate, so the config and the table stay in step.

## Not Included

- Roles or invite-only sign-up. ServiceHub shows one way: a `role` additional field and a `databaseHooks.user.create.before` check.
- Magic links, passkeys, two-factor: Better Auth plugins, added the same way as above.
