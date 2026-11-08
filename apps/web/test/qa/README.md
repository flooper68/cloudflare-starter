# QA journeys

The scripted feature QA of [how-to-qa-a-deployment.md](../../../../docs/guides/how-to-qa-a-deployment.md) as Playwright journeys that run against a deployed environment with no person involved:

```bash
QA_TOKEN=… QA_INBOX_URL=… QA_INBOX_TOKEN=… QA_EMAIL_DOMAIN=… \
  bun run test:qa -- --base-url https://starter.flooper.me
```

Each run picks a run id (`QA_RUN_ID`, e.g. `20261108k3x9`), creates its own accounts `qa-<runId>-<role>@<QA_EMAIL_DOMAIN>` through the real sign-up form and mail link, and the global teardown erases them with `cleanupRun(runId)`, also when journeys failed. Without the QA variables every journey skips with that reason, so a plain `playwright test` on a PR never fails for lack of tokens. The HTML report (with the screenshot pass) is in `apps/web/playwright-report/qa/`.

`support/env.ts`, `inbox.ts`, `fixture.ts`, `accounts.ts`, `cleanup.ts`, the config `playwright.qa.config.ts` and `scripts/qa.ts` are **stubs** of the QA infrastructure PR (Turnstile bypass header, test inbox Worker, cleanup) and follow its contract; the rest is this suite's own: `support/test.ts` (per-context setup), `limits.ts` (rate-limit pacing), `session.ts` (navigation, sign-in and sign-out in one place), `mail.ts` (mail checks), `admin.ts` (the QA admin), `mcp.ts`, `totp.ts`, `zip.ts`, `files.ts`, `screens.ts`.

## Checklist section → file

| Checklist section                                          | File                    | Notes                                                                                                                                                                                                                                                |
| ---------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Smoke suite, Landing/docs/search, Health, Security headers | —                       | Already the production smoke suite: `bun run test:smoke -- --base-url <url>` (`apps/web/test/e2e/smoke/`). Not repeated here.                                                                                                                        |
| Sign-up and email verification                             | `signup.qa.ts`          | Signs up by hand (not `createVerifiedAccount`): check-inbox, one resend, sign-in before verifying, the link, the broken link.                                                                                                                        |
| Sign-in and sign-out                                       | `signin.qa.ts`          | Wrong password answered exactly as for an address with no account; New sign-in notice from a second user agent.                                                                                                                                      |
| Password reset                                             | `password-reset.qa.ts`  | Same answer for an unknown address, link works once, changed-password notice, old password refused.                                                                                                                                                  |
| Two-factor                                                 | `two-factor.qa.ts`      | TOTP from the setup secret (`support/totp.ts`), recovery code once, emailed code, regenerated codes retire the old ones.                                                                                                                             |
| Passkeys                                                   | `passkeys.qa.ts`        | Chromium WebAuthn virtual authenticator (CDP): add, sign in, second factor still asked once TOTP is on, remove.                                                                                                                                      |
| Workspaces                                                 | `workspaces.qa.ts`      | Create, switch, invite by mail, accept, role change, transfer and back, leave. Also the member's 403 and command palette.                                                                                                                            |
| Files                                                      | `files.qa.ts`           | Binding and presigned uploads of generated 1×1 PNGs, owner-only links; the storage limit through an admin override.                                                                                                                                  |
| Billing                                                    | `billing.qa.ts`         | Manual mode as the owner sees it. Plan, add-on and override changes are in `admin.qa.ts`.                                                                                                                                                            |
| Notifications                                              | `notifications.qa.ts`   | Bell, inbox page, preferences, unsubscribe through the link's page and through the RFC 8058 one-click POST, no mail after it.                                                                                                                        |
| Settings                                                   | `settings.qa.ts`        | Name, avatar (and a non-image refused), email change with its mails, sessions, connected accounts, theme.                                                                                                                                            |
| Trash                                                      | `trash.qa.ts`           | Delete, restore (downloads again), delete forever (link answers 404).                                                                                                                                                                                |
| Privacy                                                    | `privacy.qa.ts`         | Personal and workspace exports: ready mail, ZIP read with `support/zip.ts` (manifest, NDJSON, `files/`, no secrets), same archive from Privacy page, mail link and bell; 404 signed out. Erasure is the cleanup.                                     |
| Admin portal                                               | `admin.qa.ts`           | As the QA admin: overview, user detail, suspend and lift, impersonate and stop, plan, add-on and override on the run's own workspace, audit log, read-only pages.                                                                                    |
| MCP                                                        | `mcp.qa.ts`             | Dynamic registration, the real consent page, `whoami`, `list_workspaces`, `list_files`, `list_connected_agents` (`thisConnection: true`), Disconnect, token refused (401 `invalid_token`).                                                           |
| Notes and Tasks                                            | `notes-tasks.qa.ts`     | Placeholder notice, create, edit, comment, search, trash and restore, dashboard step; the sample Tasks board.                                                                                                                                        |
| Dashboard and system screens                               | `dashboard.qa.ts`       | Get started, in-app 404, offline (context offline). The 403 is in `workspaces.qa.ts`.                                                                                                                                                                |
| Command palette                                            | `command-palette.qa.ts` | ⌘K, groups, note search, keyboard, Search trigger and Esc, no results, theme action, phone width. Member view in `workspaces.qa.ts`.                                                                                                                 |
| Demos                                                      | `demos.qa.ts`           | Queue hello; the test email to the account's own QA address.                                                                                                                                                                                         |
| Themes and mobile width                                    | `themes-mobile.qa.ts`   | Screenshot pass: every main screen at 1440 and 390 dark, light only on landing, sign-in, dashboard, members, settings account and admin overview; named `<section>-<screen>-<viewport>-<theme>.png` in the report; fails if a page scrolls sideways. |
| Cleanup                                                    | global teardown         | `cleanupRun(runId)` erases every `qa-<runId>-*` account.                                                                                                                                                                                             |

## Skips and what is not covered

| Where                                                                    | When it skips                                 | Why                                                                                                                                  |
| ------------------------------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Every file                                                               | QA variables missing                          | No tokens on PR CI.                                                                                                                  |
| `signup.qa.ts`                                                           | The environment signs up without verification | `AUTH_REQUIRE_EMAIL_VERIFICATION=false` has no check-inbox step.                                                                     |
| `two-factor.qa.ts`, emailed code                                         | No **Email me a code**                        | `TWO_FACTOR_EMAIL_OTP=off`.                                                                                                          |
| `files.qa.ts`, presigned upload                                          | The demo reports "Not uploaded."              | Presigned uploads not configured (R2 S3 keys): the checklist's N/A.                                                                  |
| `files.qa.ts` limit, `admin.qa.ts`, `themes-mobile.qa.ts` admin overview | The QA admin is not a platform admin          | The owner's one-time step below.                                                                                                     |
| `notifications.qa.ts`, digest                                            | Always                                        | The digest goes out from the 08:00 UTC cron only; no supported way to trigger it on a deployment. Check the next day's mail by hand. |
| `billing.qa.ts`                                                          | `BILLING=off`                                 | Nothing to show.                                                                                                                     |

Not covered, by design or because the app has no control for it: renaming a passkey (no rename in the UI), **mark unread** (no control in the UI), a member being refused **delete forever** and a member's note comment (both need a second account per file; the API tests cover them), changing a production feature flag (never on a shared deployment), connecting the real Claude (a test client walks the same OAuth flow). The checklist's **admin** workspace role is **owner** in this app (roles are owner and member), and **transfer ownership** and **leave** have no UI control: those steps call `workspace.transferOwnership` and `workspace.leave` as the signed-in person.

## Per-run budget

Production is shared and every request comes from one IP, so `support/limits.ts` paces the whole run (all workers) to 80% of each of the app's own per-IP limits (`packages/features/src/abuse/domain/policies.ts`): sign-up 4 a minute, sign-in 8, password reset and verification resends 2, every `/api/auth/*` call 48. A step waiting for a slot is waiting on the limit, not a fixed sleep. Run one QA run at a time.

- **Sign-ups: 21** (20 while the QA admin is not an admin), one or two per file (`workspaces` and `notifications` have two), plus the QA admin's once ever. At 4 a minute the sign-ups alone take about five minutes; the run takes about eight to ten.
- **Mails: about 60**, all to `@<QA_EMAIL_DOMAIN>`: 21 verifications plus one resend, about 15 new-sign-in notices (a sign-in from a browser with no other live session, after the account's first minute), 2 for the reset, 3 two-factor, 3 passkey, 9 workspace and notification mails, 2 for the email change, 2 export-ready, 1 demo.
- **OAuth client registrations: 1** (5 an hour per IP).

## QA admin (one-time owner step)

The admin journeys sign in as `qa-admin@<QA_EMAIL_DOMAIN>`, a persistent account that `cleanupRun` never erases. The first run creates and verifies it (its password is an HMAC of the QA token, never stored; after a token rotation the run resets it through the inbox). Production's bootstrap admin is the owner's own account and the suite never promotes anyone, so until the owner makes it an admin the admin journeys skip with that reason. After the first run, the owner promotes it once, either way:

- In the portal, as the bootstrap admin: `/admin/users` → `qa-admin@…` → Role → admin.
- From a terminal with production credentials: `bun run setup:admin --email qa-admin@<QA_EMAIL_DOMAIN> --remote --env production` (audited as `user.role_changed`, source `script`).

A platform admin can act on every account; the journeys act only on the run's own accounts and workspaces and only read the rest.

## Running it locally

Against `astro dev` with production-like settings, the inbox being Miniflare's simulated `send_email` (the stub reads it through the Local Explorer API; nothing is delivered):

1. In `apps/web/.dev.vars`: `AUTH_REQUIRE_EMAIL_VERIFICATION=true`, `TWO_FACTOR_EMAIL_OTP=on`, `EMAIL_FROM=starter@flooper.me`.
2. `E2E_LOCAL_TURNSTILE=1 bun run dev:web` (Turnstile's Siteverify simulated, as in the E2E suite).
3. Run, with the port of your `APP_URL`:

   ```bash
   QA_TOKEN=local QA_INBOX_TOKEN=local QA_EMAIL_DOMAIN=qa.test \
   QA_INBOX_URL=http://localhost:4321/cdn-cgi/local/explorer/api/local/email/sending \
     bun run test:qa -- --base-url http://localhost:4321
   ```

4. For the admin journeys, after a first run: `bun run setup:admin --email qa-admin@qa.test` (local D1).

Locally the accounts stay in the local D1 (the stub `cleanupRun` erases nothing there; the D1 is disposable, as for the E2E suite).
