---

name: setup-auth
description: Configure sign-in for this starter (Better Auth) — required secrets, turning email + password or Google on and off, email verification, the MCP OAuth server, and regenerating the auth tables after a Better Auth upgrade or new plugin. Use when the user asks to set up auth, add Google sign-in, change sign-in methods, or connect Claude via MCP.
---

# Authentication

Better Auth runs inside the web Worker (`apps/web/src/server/auth.ts`), handler at `/api/auth/*`, users and sessions in D1. It is also the OAuth server for MCP clients. Full guide: `docs/how-to-setup-auth.md`.

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

## MCP (Claude as a client)

On by default: `<APP_URL>/mcp`. In Claude, the user adds a custom connector with that URL; Claude registers itself, the user signs in and approves on `/consent`. Tools live in `apps/web/src/server/mcp/tools.ts`. Rule: every tRPC procedure gets a tool or a reasoned exemption; `parity.test.ts` enforces it.

## After upgrading Better Auth or adding a plugin

1. `cd apps/web && bunx auth@<better-auth version> generate --config scripts/auth-schema.config.ts --output ../../packages/features/src/db/schema/auth.generated.ts --yes`
2. Replace `schema/auth.ts` with the generated content (keep its header comment), delete the `.generated.ts` file.
3. `bun run db:generate`, review the SQL, `bun run db:migrate:local`.

## Verify

`bun run doctor`, then in the dev server: sign up, sign out, sign in; with email/password off, `/forgot-password` must redirect to `/sign-in`. `bun run test` covers MCP parity and the MCP server.
