---

name: setup-auth
description: Configure sign-in for this starter (Better Auth) — required secrets, turning email + password or Google on and off, email verification, who may sign up (open or invite-only, workspace mode), the MCP OAuth server, and regenerating the auth tables after a Better Auth upgrade or new plugin. Use when the user asks to set up auth, add Google sign-in, change sign-in methods, make sign-up invite-only, choose workspace mode, or connect Claude via MCP.
---

# Authentication

Better Auth runs inside the web Worker (`apps/web/src/server/auth.ts`), handler at `/api/auth/*`, users and sessions in D1. It is also the OAuth server for MCP clients. Full guide: `docs/guides/how-to-setup-auth.md`.

## Secrets

- Local: `bun run setup:secrets` (writes `apps/web/.dev.vars`) or copy `.dev.vars.example`.
- Deployed: `bun run setup:secrets --env <env>`. It sends secrets to Wrangler on stdin; never pass a secret as a command argument, never print one, never commit `.dev.vars`. It deploys a new version, so confirm first.
- `APP_URL` must equal the browser origin exactly; `BETTER_AUTH_SECRET` is 32+ characters, one per environment.

## Sign-in methods

Plain vars in `wrangler.jsonc` (`vars`, per environment) or `.dev.vars` locally:

| Var                                         | Effect                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| `AUTH_EMAIL_PASSWORD`                       | `true` (default) shows email + password sign-up, sign-in, reset, change password   |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | secrets; both set adds "Continue with Google"                                      |
| `AUTH_REQUIRE_EMAIL_VERIFICATION`           | `true` blocks sign-in until the email is verified; needs email (setup-email skill) |

At least one method must be on, or the app refuses to start. For Google, the user creates a "Web application" OAuth client and adds `<APP_URL>/api/auth/callback/google` per environment; you cannot do that for them.

## Workspaces and sign-up

Required vars per environment, no defaults and none shipped in `wrangler.jsonc` (a deploy refuses to start until they are set; `.dev.vars.example` has values for local dev): `WORKSPACE_MODE` (personal | single | multi), `SIGN_UP` (open | invite), optional `SIGN_UP_DOMAINS` and `BOOTSTRAP_ADMIN_EMAIL` (required in single mode; with invite, one of the two is required). Ask the user which mode and policy they want, then `bun run setup:auth --env <env> --dry-run`, then without `--dry-run`; it writes `wrangler.jsonc` and needs a deploy. `BOOTSTRAP_ADMIN_EMAIL` (and `SIGN_UP_DOMAINS` in single mode) refuses to start unless `AUTH_REQUIRE_EMAIL_VERIFICATION=true` or `AUTH_EMAIL_PASSWORD=false`; verification needs email (setup-email skill). Changing the mode on an environment with users is a data migration. Full guide: `docs/guides/how-to-configure-workspaces.md`.
## Abuse protection

Required vars `RATE_LIMITING` (`cloudflare`|`none`) and `TURNSTILE` (`on`|`off`), plus `TURNSTILE_SITE_KEY` (var) and `TURNSTILE_SECRET_KEY` (secret) with `on`. Locally use Cloudflare's test keys from `.dev.vars.example`. Per deployed environment the user creates a Managed Turnstile widget in the dashboard (`bun run setup:cloudflare --env <env>` prints the steps; you cannot do it for them), you put the site key in that environment's vars and they store the secret with `bun run setup:secrets --env <env>`. Limits live in `RATE_LIMIT_POLICIES` (`packages/features/src/abuse/domain/policies.ts`). Guide: `docs/guides/how-to-configure-abuse-protection.md`.

Admin portal: `ADMIN_PORTAL` (on | off) is required too, no default, asked and written by the same `setup:auth` run (`doctor` checks it). Platform admins are users with `role=admin`: the verified `BOOTSTRAP_ADMIN_EMAIL` account becomes one automatically; for anyone else run `bun run setup:admin --email <address> --dry-run`, then without `--dry-run` (local D1 by default; `--remote --env <env>` changes a deployed database, so ask first). Guide: `docs/guides/how-to-use-admin-portal.md`.

## MCP (Claude as a client)

On by default: `<APP_URL>/mcp`. In Claude, the user adds a custom connector with that URL; Claude registers itself, the user signs in and approves on `/consent`. Tools live in `apps/web/src/server/mcp/tools.ts`. Rule: every tRPC procedure gets a tool or a reasoned exemption; `parity.test.ts` enforces it.

## After upgrading Better Auth or adding a plugin

1. `cd apps/web && bunx auth@<better-auth version> generate --config scripts/auth-schema.config.ts --output ../../packages/features/src/accounts/accounts.schema.generated.ts --yes`
2. Replace `packages/features/src/accounts/accounts.schema.ts` with the generated content (keep its header comment), delete the `.generated.ts` file.
3. `bun run db:generate`, review the SQL, `bun run db:migrate:local`.

## Verify

`bun run doctor` (also checks the workspace and abuse-protection vars), then in the dev server: sign up (the Turnstile test widget passes on its own), sign out, sign in; with email/password off, `/forgot-password` must redirect to `/sign-in`; with `SIGN_UP=invite`, a stranger's sign-up shows the invite-only message. `bun run test` covers MCP parity, the MCP server, sign-up in every mode and the human check.

Account management is enabled through Settings: verified email changes (`/change-email` needs email outside local development), same-email account linking and own-session revocation without tokens in the client. See `docs/guides/how-to-use-settings.md`; preserve these options when adding auth plugins. Self-service deletion stays disabled until the serialized privacy pipeline lands.
