# How To Setup Authentication (Better Auth)

The web app signs users in with [Better Auth](https://www.better-auth.com). Users, sessions and accounts live in the same D1 database as the app data ([how-to-setup-d1.md](./how-to-setup-d1.md)), so there is no external auth provider to run. Better Auth is also the OAuth server that MCP clients such as Claude sign in through ([how-to-setup-mcp.md](./how-to-setup-mcp.md)).

## What Is Wired Up

- Handler: every `/api/auth/*` request goes to Better Auth ([pages/api/auth/[...all].ts](../../apps/web/src/pages/api/auth/[...all].ts)).
- Server config: [server/auth.ts](../../apps/web/src/server/auth.ts) — sign-in methods from env flags, D1 through the Drizzle adapter, rate limits stored in D1 (generated from the catalog), the Turnstile human check on sign-up, sign-in and password reset (`hooks.before`), the `jwt()` and `mcp()` plugins.
- Abuse protection: a per-IP edge limit in front of every `/api/auth/*` request, Better Auth's per-path limits, and Turnstile; settings `RATE_LIMITING`, `TURNSTILE`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`. See [how-to-configure-abuse-protection.md](./how-to-configure-abuse-protection.md).
- Middleware: [middleware.ts](../../apps/web/src/middleware.ts) resolves the session cookie into `Astro.locals.user` / `Astro.locals.session` and redirects anonymous `/app/*` requests to `/sign-in`.
- Browser client: [lib/auth-client.ts](../../apps/web/src/lib/auth-client.ts), with the OAuth provider plugin so a sign-in started by an MCP client continues its authorization.
- tRPC: `protectedProcedure` refuses requests without a user (`UNAUTHORIZED`); `workspaceProcedure` also resolves the user's workspace and role.
- Database hooks: `user.create.before` applies the sign-up policy (`enforceSignUpPolicy`), `user.create.after` gives the new user their workspace, `user.delete.before` deletes or leaves their workspaces ([how-to-configure-workspaces.md](./how-to-configure-workspaces.md)).

Pages:

| Route                     | What it does                                                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/sign-up`                | Name, email, password; signs in right away, or asks to verify the email first; refused with a message when sign-up is invite-only and the address is not let in |
| `/sign-in`                | The enabled methods: email + password and/or "Continue with Google"                                                                                             |
| `/forgot-password`        | Sends a reset link (only with email + password on)                                                                                                              |
| `/reset-password?token=…` | Sets a new password and revokes other sessions                                                                                                                  |
| `/consent`                | Lets the user allow or deny an MCP client                                                                                                                       |
| `/invite/<token>`         | Shows a workspace invitation and accepts it (signing in or up first)                                                                                            |
| `/app/profile`            | Shows the user; changes the password when email + password is on                                                                                                |

## Secrets

| Name                                       | Notes                                                                                                                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_URL`                                  | Public origin, no trailing slash. Better Auth's base URL and only trusted origin, so it must match the browser URL exactly (including the port locally).          |
| `BETTER_AUTH_SECRET`                       | 32+ characters, one per environment. Rotating it signs everyone out.                                                                                              |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional, see below.                                                                                                                                              |
| `TURNSTILE_SECRET_KEY`                     | Required while `TURNSTILE=on` ([how-to-configure-abuse-protection.md](./how-to-configure-abuse-protection.md)). Locally the test secret from `.dev.vars.example`. |

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

## Who May Sign Up

`SIGN_UP` (`open` or `invite`), `SIGN_UP_DOMAINS`, `BOOTSTRAP_ADMIN_EMAIL` and `WORKSPACE_MODE` are vars per environment (the first two required, none shipped: a deploy refuses to start until they are set), set with `bun run setup:auth` (`--dry-run` first). A bootstrap admin needs `AUTH_REQUIRE_EMAIL_VERIFICATION=true` unless email + password is off; once verified, that account becomes a platform admin. `ADMIN_PORTAL` (`on` | `off`, required, also written by `setup:auth`) opens the admin portal to platform admins ([how-to-use-admin-portal.md](./how-to-use-admin-portal.md)). With `SIGN_UP=invite` only invitees, the listed domains and the bootstrap admin can create an account, by any method: a refused Google sign-up lands on `/sign-in?error=SIGN_UP_INVITE_ONLY` with a message. Details, modes and invitations: [how-to-configure-workspaces.md](./how-to-configure-workspaces.md).

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

- Platform admins: Better Auth's admin plugin supplies the `role`, ban and impersonation columns and refuses suspended users at sign-in; its HTTP endpoints are closed and the admin portal acts through our use cases ([how-to-use-admin-portal.md](./how-to-use-admin-portal.md)). Upgrading Better Auth means re-checking `apps/web/src/server/admin-auth-gateway.ts`.
- API keys, self-service account-deletion UI: not built yet. Workspace roles are in [how-to-configure-workspaces.md](./how-to-configure-workspaces.md).
- Magic links, passkeys, two-factor: Better Auth plugins, added the same way as above.
