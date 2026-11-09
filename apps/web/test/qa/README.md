# QA journeys: checklist section → file

The [QA checklist](README.md#the-checklist) as unattended Playwright journeys, one file per section, run with the QA suite (`bun run test:qa -- --base-url <url>`, [how-to-qa-a-deployment.md](../../../../docs/guides/how-to-qa-a-deployment.md#the-automated-suite) for the variables, the inbox, the bypass and cleanup). Every journey uses the suite's helpers in [support/index.ts](support/index.ts); the files below in `support/` build on them:

| Helper                                                  | What it adds                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `journey.ts`                                            | `test` (`qaTest` whose contexts pace `/api/auth/*`), `newUserPage(browser)` for a second person, `skipWithoutQaEnv()`                                                                                                                                                                                                                                                                                                                                                   |
| `limits.ts`                                             | Paces every `/api/auth/*` request across the run to 80% of the app's own per-IP limits (`packages/features/src/abuse/domain/policies.ts`), modelled as each enforcer counts: Better Auth's limiter resets only after a whole window of quiet, so a burst of at most 80% of the limit, then a window of quiet (plus 2 s of slack). The slot is taken as the request is sent, by the QA routing of every context (`routing.ts`), so the run counts what the server counts |
| `session.ts`                                            | Sign-in with a rate-limit-aware wait, sign-out through the profile menu, settings sections, the workspace switcher                                                                                                                                                                                                                                                                                                                                                      |
| `mail.ts`                                               | The checklist's mail checks: sender `starter@flooper.me` "Cloudflare Starter", subject, links on the environment's origin, `List-Unsubscribe` and `List-Unsubscribe-Post` on notifications and none on security mails                                                                                                                                                                                                                                                   |
| `admin.ts`                                              | `qaAdmin()`, `ensureQaAdmin()` (the global setup provisions and verifies the QA admin `qa+admin@<emailDomain>` through the bypass and the QA outbox) and `signInQaAdmin(page)` (signs it in fresh; its admin power lasts an hour from a browser sign-in)                                                                                                                                                                                                                |
| `mcp.ts`, `totp.ts`, `zip.ts`, `files.ts`, `screens.ts` | An MCP client (dynamic registration, consent, tool calls), authenticator codes from the setup secret (`@better-auth/utils`, already a devDependency: no new package), a ZIP reader for exports, generated 1×1 PNGs, the screenshot pass                                                                                                                                                                                                                                 |

| Checklist section                                    | File                    | Notes                                                                                                                                                                                                                         |
| ---------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Smoke, landing/docs/search, health, security headers | —                       | The production smoke suite (`bun run test:smoke`), not repeated.                                                                                                                                                              |
| Sign-up and verification                             | `signup.qa.ts`          | By hand, not `createVerifiedAccount`: check-inbox, one resend, sign-in before verifying, the link, the broken link.                                                                                                           |
| Sign-in and sign-out                                 | `signin.qa.ts`          | Wrong password answered exactly as for an address with no account; New sign-in notice from another user agent (after the account's first minute, the server's rule).                                                          |
| Password reset                                       | `password-reset.qa.ts`  | Same answer for an unknown address, link works once, changed-password notice, old password refused; then the suite's password again so cleanup can sign in.                                                                   |
| Two-factor                                           | `two-factor.qa.ts`      | TOTP from the setup secret, recovery code once, emailed code, regenerated codes retire the old ones; two-factor off at the end for cleanup.                                                                                   |
| Passkeys                                             | `passkeys.qa.ts`        | WebAuthn virtual authenticator (CDP): add, sign in, second factor still asked with TOTP on, remove.                                                                                                                           |
| Workspaces                                           | `workspaces.qa.ts`      | Create, switch, invite by mail, accept, role change, transfer and back, leave. Also the member's 403 (dashboard section) and the member's command palette.                                                                    |
| Files                                                | `files.qa.ts`           | Binding and presigned uploads of generated PNGs, owner-only links; the storage limit through an admin override.                                                                                                               |
| Billing                                              | `billing.qa.ts`         | Manual mode as the owner sees it; plan, add-on and override in `admin.qa.ts`.                                                                                                                                                 |
| Notifications                                        | `notifications.qa.ts`   | Bell and inbox page, preferences, unsubscribe through the link's page and through the RFC 8058 one-click POST, no mail after it.                                                                                              |
| Settings                                             | `settings.qa.ts`        | Name, avatar (and a non-image refused), email change through its mails, sessions, connected accounts, theme. Erases its own account (it no longer has the address cleanup knows).                                             |
| Trash                                                | `trash.qa.ts`           | Delete, restore (downloads again), delete forever (link answers 404).                                                                                                                                                         |
| Privacy                                              | `privacy.qa.ts`         | Personal and workspace exports: ready mail, ZIP contents (manifest, NDJSON, `files/`, no secrets), same archive from the page, the mail and the bell, 404 signed out. Erasure is the cleanup.                                 |
| Admin portal                                         | `admin.qa.ts`           | As the QA admin: overview, user detail, suspend and lift, impersonate and stop, plan, add-on and override on the run's own workspace, audit log, read-only pages.                                                             |
| MCP                                                  | `mcp.qa.ts`             | Registration, consent page, `whoami`, `list_workspaces`, `list_files`, `list_connected_agents` (`thisConnection: true`), Disconnect, token refused.                                                                           |
| Notes and Tasks                                      | `notes-tasks.qa.ts`     | Placeholder notice, create, edit, comment, search, trash and restore, dashboard step; the sample board.                                                                                                                       |
| Dashboard and system screens                         | `dashboard.qa.ts`       | Get started, in-app 404, offline (context offline).                                                                                                                                                                           |
| Command palette                                      | `command-palette.qa.ts` | ⌘K, groups, note search, keyboard, Search trigger and Esc, no results, theme action, phone width.                                                                                                                             |
| Demos                                                | `demos.qa.ts`           | Queue hello; the test email to the account's own QA address.                                                                                                                                                                  |
| Themes and mobile width                              | `themes-mobile.qa.ts`   | Every main screen at 1440 and 390 dark, light only on landing, sign-in, dashboard, members, settings account and admin overview; `<section>-<screen>-<viewport>-<theme>.png` in the report; fails if a page scrolls sideways. |
| Cleanup                                              | global teardown         | `cleanupRun` through `POST /api/qa/cleanup` (no sign-ins, no erasure limit), then the nightly cleanup for what a killed run left.                                                                                             |

## Skips and gaps

| Where                            | Skips when                            | Why                                                                   |
| -------------------------------- | ------------------------------------- | --------------------------------------------------------------------- |
| Every file                       | QA variables missing                  | `qaSkipReason()`.                                                     |
| `signup.qa.ts`                   | Sign-up signs in without verification | `AUTH_REQUIRE_EMAIL_VERIFICATION=false`.                              |
| `two-factor.qa.ts`, emailed code | No **Email me a code**                | `TWO_FACTOR_EMAIL_OTP=off`.                                           |
| `files.qa.ts`, presigned         | The demo reports "Not uploaded."      | Presigned uploads not configured: the checklist's N/A.                |
| `notifications.qa.ts`, digest    | Always                                | Sent by the 08:00 UTC cron only; nothing triggers it on a deployment. |
| `billing.qa.ts`                  | `BILLING=off`                         | Nothing to show.                                                      |

Not covered: renaming a passkey and **mark unread** (no control in the UI); a member refused **delete forever** and a member's note comment (a second account per file; the API tests cover them); production feature flags (never changed on a shared deployment); the real Claude (a test client walks the same OAuth flow). The app's workspace roles are owner and member (the checklist's "admin" is owner here), and transfer ownership and leave have no UI control: those steps call `workspace.transferOwnership` and `workspace.leave` with `callApp`.

## Per-run budget

- **Sign-ups: 21** (plus the QA admin's, once ever): one per file, two in `workspaces` and `notifications`. At 4 per burst and a minute of quiet after each (`limits.ts`), sign-ups alone take about six minutes; a whole run about 20 minutes with one worker.
- **Mails: about 60**, all to run addresses: 21 verifications plus one resend, up to about 15 new-sign-in notices (a sign-in from a browser with no other live session, after the account's first minute), 2 for the reset, 3 two-factor, 3 passkey, about 9 workspace and notification mails, 2 for the email change, 2 export-ready, 1 demo, and the erasure mails of the cleanup.
- **Account erasures:** 1 in `settings.qa.ts` (3 an hour per IP); the cleanup goes through `/api/qa/cleanup`, which counts against `qa.bypass` only.
- **OAuth client registrations: 1** (5 an hour per IP).

Better Auth's counters live in D1 and outlive a run: start a run at least a minute after the previous one ended.

## The automated suite

Playwright journeys in [apps/web/test/qa/](./) (`*.qa.ts`, project `qa` of [apps/web/playwright.qa.config.ts](../../playwright.qa.config.ts)) drive the deployed app in Chromium like a person: the real forms, the real mail the app renders, the real erasure. Nothing reads or writes the database directly.

The only input is the QA token. From a laptop, with nothing else set up:

```bash
QA_TOKEN=… bun run test:qa -- --env production   # the URL comes from env.production's route in wrangler.jsonc
QA_TOKEN=… bun run test:qa -- --base-url https://starter.flooper.me   # the same, by URL
```

`QA_TOKEN` is the production Worker secret of the same name (also the GitHub secret of the environment `qa`). Without it every journey skips and says so (CI fails instead). The HTML report, traces, screenshots and videos of failures land in `apps/web/playwright-report/qa` and `apps/web/test-results/qa`.

How a run works:

- **Accounts.** Every account is `qa+<runId>-<role>@qa.flooper.me` (`QA_EMAIL_DOMAIN`): `<runId>` is the date and four random letters (`20261108kqzt`), one per `playwright test`, set by the global setup (`QA_RUN_ID`). Never the owner's own account.
- **Passwords** are generated in code from the address and the QA token (`support/password.ts`), the QA admin's too, so any later process can sign in again without a password ever being stored. They are never logged; CI scrubs them, the token and every session cookie from the report before uploading it.
- **Mail** to a QA address is not sent: the app keeps it in its [QA outbox](#the-qa-outbox), and `inbox.waitFor` reads it there. Links in a mail must point at the environment's origin, or the journey fails without following them.
- **Turnstile.** The browser loads a stub instead of Cloudflare's widget script, and every request to the app's origin (only that origin) carries `X-QA-Token`. For a QA address the server skips the Turnstile check and records `qa.bypass.used`; for any other address the check runs as for everyone ([the QA bypass](../../../../docs/reference/abuse-protection.md#qa-bypass)).
- **The QA admin** (`qa+admin@qa.flooper.me`) provisions itself: the global setup signs it up through the bypass when it does not exist, verifies it through the outbox and signs in; the app makes exactly that account a platform admin ([the QA admin](../../../../docs/reference/abuse-protection.md#the-qa-admin)). Journeys that need the admin portal sign in as `qaAdmin()`.
- **One journey at a time, no retries.** Production is shared and limited per IP: sign-up allows 5 a minute, sign-in 10 a minute and account erasure 3 an hour. Do not load-test or trip limits on purpose.
- **Production is shared.** Journeys change feature flags, settings and plans of their own QA workspaces only.
- **Cleanup.** The global teardown erases every account of the run, whatever happened (`cleanupRun`), through the app's [QA cleanup endpoint](#the-qa-cleanup): the real erasure, no admin, no browser. What it cannot erase now (a killed runner) the [nightly cleanup](#nightly-cleanup) erases.

Optional checks a person does by hand, because a headless browser cannot: _(human-only, optional)_

- **A real Turnstile challenge.** Open `/sign-up` in a normal browser: the widget appears and passes (or shows a challenge you solve), and a sign-up with a non-QA address works. The suite stubs the widget and the smoke suite only checks that its script and frame are allowed.
- **A real phone passkey.** The suite uses Chromium's virtual authenticator; adding a passkey from a phone (cross-device QR) and signing in with it needs the device.

Before a release: the Deploy workflow's smoke job passed (or run `bun run test:smoke -- --env production`), and note the deployed version (`releaseId` in `GET /health/ready`).

### Writing a journey

A journey is a `*.qa.ts` file in `apps/web/test/qa/` that imports from [support/](support/index.ts):

| Helper                                                                          | What it does                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `qaTest`, `expect`                                                              | Playwright's `test` with the E2E CSP guard; every context sends `X-QA-Token` to the app's origin only and loads the Turnstile stub. Fixture `runId`.                                                                                  |
| `qaEnv()`                                                                       | `{ baseURL, token, emailDomain }` from `QA_BASE_URL` and `QA_TOKEN` (and the optional `QA_EMAIL_DOMAIN`); one error naming every missing one. `qaSkipReason()` for `qaTest.skip`.                                                     |
| `qaAddress(runId, role)`                                                        | `qa+<runId>-<role>@<QA_EMAIL_DOMAIN>`; `role` is lowercase letters and digits.                                                                                                                                                        |
| `inbox.waitFor({ to, subject?, since, timeoutMs? })`                            | The newest mail to `to` since `since` from the QA outbox: `{ subject, from, text, html, headers, links }`; `headers` has lowercase names (`message-id`, `list-unsubscribe`, `list-unsubscribe-post`). `inbox.clear(to)` deletes them. |
| `createVerifiedAccount(page, { role })`                                         | Signs up through the form, opens the verification mail's link, ends on the dashboard; returns `{ email, password }` and records the account for cleanup.                                                                              |
| `qaAdmin()`                                                                     | The QA admin's `{ email, password }` (the global setup made sure it exists and is verified).                                                                                                                                          |
| `eraseQaAccount(browser, account)`, `cleanupRun(runId)`                         | Erasure: one account through Settings › Privacy, or the whole run through the QA cleanup endpoint.                                                                                                                                    |
| `open(page, path)`, `signIn(page, account)`, `callApp(page, kind, path, input)` | Navigation that waits for hydration, the sign-in form, and a tRPC call as the signed-in page makes it.                                                                                                                                |

Start every file with `qaTest.skip(qaSkipReason() !== null, qaSkipReason() ?? "")`, take `since` just before the action that sends mail, and never log a password or put one in an assertion message. [account-lifecycle.qa.ts](account-lifecycle.qa.ts) is the worked example (sign up → verify → dashboard → erase).

Which file covers which checklist section, what each one skips and why, and the run's sign-up and mail budget: [apps/web/test/qa/README.md](README.md).

## The QA outbox

With `QA_BYPASS=on`, mail the app would send to a QA address (`qa@` or `qa+<tag>@` in `QA_EMAIL_DOMAIN`) is not sent: the email adapter keeps it in the app's own table `qa_outbox` instead (`withQaOutbox`, wired once in `apps/web/src/lib/env.ts`, so every mail of every feature is covered). Mail to anyone else is sent as always; the port sends one recipient per call, so a mail to a QA address and a real one still reaches the real one.

- **What is kept:** recipient, sender, subject, the text and HTML bodies and every header the message would have had, lowercase: `from`, `to`, `subject`, `date`, a `message-id` on the sender's domain (Cloudflare sets its own when it sends), `mime-version`, and the message's own (`list-unsubscribe`, `list-unsubscribe-post`).
- **Retention:** 24 hours. Reads never return older mail; the daily `qa-outbox.purge` job (cron 03:17 UTC) deletes it.
- **Reading:** `GET /api/qa/outbox?to=<address>&since=<iso>&subject=<substring>` (newest first, at most 50) and `DELETE /api/qa/outbox?to=<address>`, with `X-QA-Token`. Only with `QA_BYPASS=on` (404 otherwise); every request counts against `qa.bypass` (30 a minute per IP) before the token is compared; `to` must be a run address `qa+<runId>-<role>@…` or the QA admin's `qa+admin@…` (URL-encode the `+` as `%2B`).
- **Its limits:** nothing leaves the app, so the outbox tests what the app renders and sends to the port, not delivery: Cloudflare Email Service, the sender domain, SPF/DKIM/DMARC and spam placement. The [weekly delivery check](#weekly-delivery-check) covers that path with one real mail.

## The QA cleanup

`POST /api/qa/cleanup` with `X-QA-Token` (same gate as the outbox: `QA_BYPASS=on`, `qa.bypass`) erases the suite's own run accounts through the real erasure (the same preparation, auth deletion and completion as a person's own account deletion, recorded as `user.deleted` by the system), at most 20 per call:

- `{ "runId": "20261108kqzt" }`: that run's `qa+20261108kqzt-<role>@` accounts, of any age (the global teardown);
- `{}`: every run account older than two hours (the nightly cleanup).

Never the QA admin, never `qa+<other tag>@`, never any other address. Shared workspaces that only the erased accounts use go with them; an account that is the last manager of a workspace someone else still uses is answered in `remaining`. Answer: `{ "erased": [...], "remaining": [...] }`.

## CI

The workflow **QA** ([.github/workflows/qa.yml](../../../../.github/workflows/qa.yml)) has three jobs, on GitHub-hosted runners only, and takes an environment, never a URL (`bun run test:qa -- --env production` resolves the route in `apps/web/wrangler.jsonc`, so the QA token only goes to the repository's own routes):

- **`qa`** runs the suite. The Deploy workflow calls it after a production deploy whose smoke suite passed; Actions › QA › Run workflow runs it by hand. It fails when `QA_TOKEN` is missing or any journey fails, scrubs the report and the traces (`scripts/qa-scrub-artifacts.py`: the token, the QA passwords, every cookie, `set-cookie`, `authorization` and `x-qa-token` header value, and token-shaped values such as session cookies, JWTs, `token=` query parameters and reset links; it fails if anything is left, and the upload then does not run) and uploads it as `qa-report-<run id>`, kept 3 days. The repository is public: the artifact is too. Then, whatever the suite did (failed, timed out or was cancelled), it erases the run's accounts and every leftover over two hours old: project `qa-cleanup` with the same `QA_RUN_ID`, fixed by the job before the suite starts, so the global teardown's `cleanupRun` and the [nightly cleanup](#nightly-cleanup) both run again.
- **`cleanup`**, nightly at 03:37 UTC (and by hand with `cleanup` ticked): the [nightly cleanup](#nightly-cleanup).
- **`delivery`**, weekly on Mondays at 07:47 UTC (and by hand with `delivery` ticked): the [weekly delivery check](#weekly-delivery-check).

The one secret is `QA_TOKEN` in the GitHub environment `qa` (deployment branches: `main` only; no required reviewers, so it runs unattended), the same value as the production Worker secret. Nothing else is set up by the owner: no QA admin password, no inbox, no account.

### Nightly cleanup

`cleanup/leftovers.cleanup.ts` (project `qa-cleanup`) calls the [QA cleanup endpoint](#the-qa-cleanup) without a run id until nothing more goes: every run account older than two hours, so never a run in progress. No admin and no browser, never SQL. It fails if an account cannot be erased.

### Weekly delivery check

`delivery/real-delivery.delivery.ts` (project `qa-delivery`) signs in as the QA admin and calls the admin portal's **send test email** (`admin.email.sendTest`) for `QA_DELIVERY_ADDRESS`, a plain variable of the workflow's `delivery` job (`premysl.ciompa+qa-delivery@gmail.com`, the owner's own address, not a secret; production only). It asserts only that the app accepted and sent the mail. Whether it arrived, and not in spam, a person checks in that mailbox when needed: the outbox model never tests delivery or DNS.

### Starter-only values

These are the starter's own production's, set for the starter's maintainer; a project built from the starter changes them or turns the bypass off:

- `QA_BYPASS: "on"` in production and develop and `QA_EMAIL_DOMAIN: "qa.flooper.me"` (`apps/web/wrangler.jsonc`). The domain needs no mail servers: QA mail never leaves the app. Pick a subdomain of your own that nobody else can receive mail for, or set `QA_BYPASS` to `off` until you run the suite.
- `QA_DELIVERY_ADDRESS` of the `delivery` job (`.github/workflows/qa.yml`): an inbox you read.
- The starter's own production holds only test data; when `0000_init` changes (it gained `qa_outbox` with the outbox) its database is reset rather than migrated ([how-to-setup-d1.md](../../../../docs/guides/how-to-setup-d1.md)). A project with real data adds numbered migrations instead.

## The checklist

The spec the journeys implement: each section is a journey (or part of one), with what it does, the expected result and the mail it checks. Steps marked _(human-only, optional)_ are not automated. Record a manual check, or a failed automated one, in the [run record](#run-record) as pass, fail (with the screenshot and the reference/trace id shown in the error) or N/A (with the reason).

For every mail: it is in the QA outbox, the sender is `starter@flooper.me` ("Cloudflare Starter"), the subject, links point at the environment's origin, and (for notifications) the `List-Unsubscribe` and `List-Unsubscribe-Post` headers. Accounts below: A (`qa+<runId>-a@qa.flooper.me`, owner), B (`qa+<runId>-b@qa.flooper.me`, invitee) in a separate browser context.

### Sign-up and email verification

Guides: [how-to-setup-auth.md](../../../../docs/guides/how-to-setup-auth.md), [how-to-configure-workspaces.md](../../../../docs/guides/how-to-configure-workspaces.md), [how-to-configure-abuse-protection.md](../../../../docs/guides/how-to-configure-abuse-protection.md), [how-to-setup-email.md](../../../../docs/guides/how-to-setup-email.md).

1. Open `/sign-up`. The Human check shows and passes (the suite's stub; the real widget is a [human-only check](#the-automated-suite)).
2. Sign up account A with name `QA <runId> A`: **Check your inbox** names A's address.
3. Press **Resend link** once: "Sent." shows. (Pressing it four times within a minute shows the rate-limit wait; do not do that on production.)
4. Sign in as A before opening the mail: the same **Check your inbox** card shows instead of an error.
5. Open the newest verification mail and follow its link: **Email verified**, then **Continue to the app**.
6. Open `/email-verified?error=INVALID_TOKEN`: **This link doesn't work** with **Send a new link**.
7. Repeat steps 1, 2 and 5 for account B in a separate browser context (keep it for B's steps below).

Expected: before verification, sign-in shows the check-inbox card; after the link, the person lands in `/app/dashboard` with a personal workspace on a trial plan, and the dashboard's **Get started** list shows "Verify your email" done.
Mail: **Verify your email** (to each account, once more after Resend).

### Sign-in and sign-out

1. Sign out (profile menu, the avatar at the bottom of the sidebar → Sign out); you land on `/`.
2. Sign in as A at `/sign-in` with a wrong password: refused, no hint whether the email exists.
3. Sign in with the right password.

Expected: `/app/dashboard`; `/app` signed out redirects to `/sign-in`; the audit log (admin section) has the failed and the successful sign-in.
Mail: **New sign-in to your account** when the sign-in is from a new browser or device.

### Password reset

1. Sign out, open `/forgot-password`, enter A's email (Turnstile passes).
2. Follow the reset link, choose a new password.
3. Sign in with the old password (refused) and the new one (works).

Expected: the reset page says a mail was sent whether or not the account exists; the link works once.
Mail: **Reset your password**, then **Your password was changed** (a security notice, also in the inbox).

### Two-factor: authenticator, backup codes, email code

Guide: [how-to-configure-account-security.md](../../../../docs/guides/how-to-configure-account-security.md).

1. Settings → Security → set up an authenticator: read the manual key (the journey computes codes from it, as an authenticator app would) and confirm a six-digit code with the current password.
2. Keep the recovery codes for the next steps.
3. Sign out and sign in: `/two-factor` asks for a code. Enter one from the authenticator.
4. Sign out and sign in with a recovery code instead. Use the same code again on the next sign-in: refused.
5. Sign out and sign in choosing the emailed code; enter the code from the mail.
6. Regenerate recovery codes: the old ones stop working.

Expected: each factor completes sign-in once; a wrong code is refused (ten failures lock verification for 15 minutes, so do not try that on production).
Mail: **Your account security changed** on enrollment and regeneration; **Your verification code** for the emailed code.

### Passkeys

1. Settings → Security → add a passkey, name it `QA <runId>` (Chromium's virtual authenticator; a passkey on a real phone is a [human-only check](#the-automated-suite)).
2. Sign out, sign in with the passkey.
3. Because A has an authenticator, the second factor is still asked for.
4. Rename and then remove the passkey.

Expected: the passkey appears in the list with its name; sign-in works; removal takes it off the list.
Mail: **Your account security changed** on add and remove.

### Workspaces: create, switch, invite, accept, roles, leave, transfer

Guide: [how-to-configure-workspaces.md](../../../../docs/guides/how-to-configure-workspaces.md).

1. As A, create a workspace `QA <runId> shared` (workspace menu → Create workspace) and switch between it and the personal workspace with the switcher.
2. Members → Invite people: invite B as **member**.
3. As B, open the invitation mail link (`/invite/<token>`) and accept.
4. As A, change B's role to **admin**; then transfer ownership to B.
5. As B (now owner), transfer ownership back to A.
6. As B, leave the workspace.

Expected: the switcher shows both workspaces; B sees the shared workspace only after accepting; A gets an unread badge for B joining; role changes show on the Members page at once; after leaving, B no longer sees the workspace and A's Members page no longer lists B.
Mail: **QA <runId> A invited you to QA <runId> shared** (to B); **member joined** (to A); **role changed** (to B).

### Files: both upload paths and limits

Guides: [how-to-setup-r2.md](../../../../docs/guides/how-to-setup-r2.md), [how-to-configure-plans-and-billing.md](../../../../docs/guides/how-to-configure-plans-and-billing.md).

1. As A in `QA <runId> shared`, open `/app/upload-demo`. Upload a small PNG through the **binding** card.
2. Upload another through the **presigned URL** card (direct to R2). If it reports a configuration error, presigned uploads are not configured for the environment: N/A.
3. Open each file's link: it downloads the same bytes.
4. Limits: in the [billing](#billing-manual-mode-and-admin-override) section's override, set the workspace's storage limit to 1 MB, then upload a 2 MB file.

Expected: both files are listed with size and type; over the limit the upload is refused before any bytes are stored, with an upgrade prompt naming the limit.
Mail: none.

### Billing: manual mode and admin override

Guide: [how-to-configure-plans-and-billing.md](../../../../docs/guides/how-to-configure-plans-and-billing.md). Production runs `BILLING=manual`.

1. As A, open `/app/billing`: the trial plan, its end date and usage meters; no checkout (manual mode).
2. As the QA admin, open `/admin/workspaces` → `QA <runId> shared` → Billing: assign a plan, set an add-on, set a storage-limit override of 1 MB with reason `QA <runId>` (used by [files](#files-both-upload-paths-and-limits)). Only shared workspaces are listed there: a personal workspace belongs to its user and has no admin page (on a user's page its name is not a link).
3. Remove the override and set the plan back.

Expected: A's billing page reflects each change after a reload (the plan name, the add-on as "5 more seats × 1", the overridden limit's value, e.g. Storage 1 MB); the admin's billing panel lists the override under **Current overrides** (A's page shows the value, with no marker that it is an override); every change appears in the audit log as `billing.*`.
Mail: none.

### Notifications: inbox, email, digest, unsubscribe

Guide: [how-to-send-notifications.md](../../../../docs/guides/how-to-send-notifications.md).

1. As A, open the bell: the notifications produced so far (member joined, password changed, security changes). Open one, mark it read, mark it unread, archive one.
2. `/app/notifications/preferences`: set **member joined** to email as a **daily digest**; try to turn off a security notice (it cannot be turned off).
3. Trigger one more member notification (invite and accept a third QA address, or B re-joins) and check the next day's digest after 08:00 UTC. If the run cannot wait, mark the digest check deferred and finish it the next day.
4. In a notification mail, use the footer's unsubscribe link: `/unsubscribe` confirms with one click; the preference shows as off.

Expected: the badge count matches the unread items; the digest groups the day's items in one mail; unsubscribe needs no sign-in and changes only that type.
Mail: the notification mails above; **digest** (next day); none after unsubscribing.

### Settings: profile, avatar, email change, sessions, connected accounts

Guides: [how-to-use-settings.md](../../../../docs/guides/how-to-use-settings.md), [how-to-define-branding.md](../../../../docs/guides/how-to-define-branding.md) (appearance only).

1. Settings → Account: change the name; upload an avatar (PNG under the size limit), then remove it.
2. Change the email to `qa+<runId>-a2@qa.flooper.me`. A verified account gets **Confirm email change** at its current address; its link sends **Verify your email** to the new address, and that link changes the address (marked verified) and signs in. Sign out and sign in with the new address. (An unverified account gets only the **Verify your email** at the new address. If the new address already has an account, no mail is sent and the page answers the same.)
3. Settings → Security: sessions lists this browser context and a second one A signed in from; revoke the other one (that context is signed out on its next request).
4. Connected accounts: lists the email/password method (and Google if it is enabled for the environment).
5. Settings → Appearance: dark, light and system theme; the change persists after a reload.

Expected: the header avatar and name update at once; an oversize or non-image avatar is refused.
Mail: **Confirm email change** (to the current address), then **Verify your email** (to the new address).

### Trash: delete, restore, purge

Guide: [how-to-use-trash.md](../../../../docs/guides/how-to-use-trash.md).

1. Delete one of the uploaded files: it leaves the file list and appears in `/app/trash`.
2. Restore it: it is back in the list and downloads.
3. Delete it again and **delete forever** from the trash (owner only).

Expected: the trash shows who deleted what and when; a member cannot delete forever; the purged file's link answers 404.
Mail: none.

### Privacy: export download and account erasure

Guide: [how-to-handle-data-privacy.md](../../../../docs/guides/how-to-handle-data-privacy.md).

1. As A, Settings → Privacy → Export your data (personal), and as owner the workspace export of `QA <runId> shared`.
2. Wait for **ready** (reload), download the ZIP from the Privacy page, the inbox and the bell. Open it: `manifest.json`, `data/…` NDJSON, the uploaded files under `files/`; no password hashes, tokens or recovery codes.
3. Account erasure is the [cleanup](#cleanup) at the end of the run.

Expected: each download is the same archive; the signed link opened signed out (or as B) answers 404.
Mail: **Your data export is ready** (one per export).

### Demo mode: notice, sample notes, retention

Guide: [how-to-run-a-public-demo.md](../../../../docs/guides/how-to-run-a-public-demo.md). Production and staging run with `DEMO_MODE=on`; skip this section on an environment with `off`.

1. Signed out, open `/sign-up`: above the form, "Demo instance: your account and data are deleted after 7 days." and **Get the starter on GitHub** (opens the repository in a new tab).
2. As A (just signed up), every app page shows the same banner. Dismiss it: it stays hidden after a reload and in the same tab; a new tab or a new browser session shows it again.
3. Notes: within a few seconds of sign-up, three notes titled `Sample: …`; **Sample: Welcome to the demo** has one comment. Editing, trashing and restoring them works like any note.
4. As the QA admin, `/admin/overview`: the **Demo instance** card with active demo accounts, deletions scheduled today and deleted in the last 7 days; `/admin/settings` → **Demo mode** shows the retention, sample data, protected accounts and the QA domain.
5. The QA accounts of the run are in `QA_EMAIL_DOMAIN`: the retention never warns or erases them (their own [cleanup](#cleanup) does). The warning and the erasure of a real demo account take a week; check them on the audit log instead: `demo.deletion_warned`, then `demo.account_erased` a day later, both by the system.

Expected: no demo notice anywhere with `DEMO_MODE=off`.
Mail: none for the QA accounts. A demo account gets **Your demo account will be deleted tomorrow** (links to Settings › Privacy and to GitHub) a day before **Your account was deleted**.

### Admin portal

Guides: [how-to-use-admin-portal.md](../../../../docs/guides/how-to-use-admin-portal.md), [how-to-use-the-audit-log.md](../../../../docs/guides/how-to-use-the-audit-log.md), [how-to-use-feature-flags.md](../../../../docs/guides/how-to-use-feature-flags.md), [how-to-monitor-health.md](../../../../docs/guides/how-to-monitor-health.md). As the QA admin (`qaAdmin()`, [self-provisioned](#the-automated-suite)); act only on the QA accounts and workspaces of the run.

1. `/admin/overview`: counts include the QA accounts; the Health card shows every check passing (or warn, with a reason).
2. Users: search `qa+<runId>`, open B: sign-in methods, workspaces, sessions (no tokens).
3. Suspend B with reason `QA <runId>`: B's open session ends and B's sign-in is refused. Lift the suspension: B signs in again.
4. Impersonate A: the impersonation banner shows; stop impersonating returns to the admin.
5. `/admin/audit`: filter by A and by B: sign-ins, the suspension, the impersonation, workspace and billing changes of the run, each with a trace id.
6. `/admin/flags`: the flags list opens. Do not change production flags; to test a change, add a rule that targets only `QA <runId> shared` and remove it again.
7. `/admin/workspaces`: `QA <runId> shared` with its members and billing panel (shared workspaces only; personal ones have no admin page).
8. `/admin/data-requests`: the run's export requests.
9. `/admin/settings`: read-only values match `wrangler.jsonc` production vars.

Expected: destructive actions ask for a recent sign-in (and the admin's second factor when enrolled); an admin cannot act on their own account.
Mail: **Your password was changed** or security notices only if those actions are taken; none for suspension.

### MCP: connect Claude and call a tool

Guide: [how-to-setup-mcp.md](../../../../docs/guides/how-to-setup-mcp.md).

1. Connect an MCP client to `https://starter.flooper.me/mcp` the way Claude does: dynamic client registration, then OAuth authorization with PKCE in the browser. _(human-only, optional: the same with claude.ai → Settings → Connectors → custom connector.)_
2. Sign in as A. The consent page names the client, A's address and its redirect host, lists what it may do in plain words (use the tools as you, see your name and email, stay connected) and says where to revoke it; click Allow.
3. Call `whoami`, then `list_workspaces` and `list_files` for `QA <runId> shared`.
4. Call `list_connected_agents`: the client is listed with `thisConnection: true`.
5. Settings → Connected agents: the client is listed with the date it was connected, its permissions in plain words and the browser that approved it. Click **Disconnect**, confirm; the next tool call fails with an authorization error.

Expected: the tools answer as A with A's workspaces only; A's audit log shows the tool calls' changes, none for reads, plus `mcp.client.authorized` and `mcp.client.revoked`.
Mail: possibly **New sign-in to your account** for the consent sign-in.

### Placeholder apps: Notes and Tasks

Guide: [how-to-add-a-feature.md](../../../../docs/guides/how-to-add-a-feature.md).

1. As A in `QA <runId> shared`, sidebar → **Notes**: the Placeholder badge and notice show; with no notes, **No notes yet** with **New note**.
2. Create a note `QA <runId> note`, edit its body, add a comment.
3. As B (a member), open the note and comment too; search the list for its title.
4. Move it to the trash: it leaves the list; Trash lists it as `QA <runId> note`; restore it: it is back with both comments.
5. Sidebar → **Tasks**: the sample board; switch to the list; reload: the sample data starts over.
6. Admin portal → audit log: `note.created`, `note.updated`, `note.commented`, `trash.item_trashed`, `trash.item_restored` for the note, without its text.

Expected: the dashboard's "Write your first note" step is done after step 2; Billing → Usage shows Notes against the plan's limit (Free 50, Pro unlimited).
Mail: none.

### Dashboard and system screens

Guides: [how-to-configure-workspaces.md](../../../../docs/guides/how-to-configure-workspaces.md), [how-to-configure-account-security.md](../../../../docs/guides/how-to-configure-account-security.md).

1. As A, `/app/dashboard`: **Get started** lists Verify your email (done), Invite a teammate, Turn on two-factor authentication, Write your first note, each open step with its button; the count matches.
2. After the workspace steps above (B joined, A has an authenticator), the list shows those steps done.
3. As B (a member of `QA <runId> shared`), open `/app/settings/workspace`: **You don't have access to this**, naming A as the owner, and **Back to dashboard**.
4. Open `/app/no-such-page`: **Page not found** inside the app shell.
5. Take the browser offline: the **You're offline.** strip appears at the top of the app; **Try again** keeps it; back online, it goes away.

Expected: no blank areas, no raw errors; the 403 and 404 views keep the sidebar.
Mail: none.

### Command palette

Guide: [how-to-add-a-feature.md](../../../../docs/reference/adding-a-feature.md#navigation-and-the-command-palette).

1. As A on `/app/dashboard`, press ⌘K (Ctrl+K): the palette opens with the search focused and the groups Navigate, Workspaces (multi mode) and Actions.
2. Type part of `QA <runId> note`'s title: it shows under **Notes** (briefly "Searching notes…"); Enter opens it. A note in the trash is never listed.
3. ⌘K, type `Settings`, Enter: **Account settings** opens. ↑ ↓, Home and End move the selection.
4. Click **Search** in the top bar, press Esc: the palette closes and focus is back on Search. Type `zzzz`: **No results for "zzzz"**.
5. As B (a member of `QA <runId> shared`): ⌘K lists no **Settings: Workspace**, no **Invite member** and no **Admin**. As the admin, **Admin** is listed.
6. At phone width (a 375 px viewport): the trigger is a search icon without a key hint; the palette fills the screen with **Cancel**.

Expected: works in both themes; selecting **Switch to the light theme** switches and remembers it after a reload.
Mail: none.

### Demos: queue and email

> **Starter-only, removed by `starter:strip`** (`developer-demos`): the demo pages. A project checks its own jobs and mail instead.

Guides: [how-to-add-background-jobs.md](../../../../docs/guides/how-to-add-background-jobs.md), [how-to-setup-email.md](../../../../docs/guides/how-to-setup-email.md).

1. Dashboard → **Developer demos** (`/app/demos`) lists Upload, Queue and Email.
2. `/app/queue-demo`: enqueue a hello job; it shows as processed.
3. `/app/email-demo`: send the test email to A.

Expected: the job completes within a minute; the mail arrives.
Mail: **[production] Starter kit test email**.

### Landing, docs and search

Guide: [how-to-publish-docs-and-landing.md](../../../../docs/guides/how-to-publish-docs-and-landing.md).

1. `/`: the hero, the feature cards, "Built on" and the three steps; the header's Sign in and Open app (signed in, it opens the dashboard; signed out, sign-in), Read the docs, View on GitHub.
2. `/_storybook/` opens the component library.
3. `/docs/`: the docs index with the navigation; open a guide from the navigation, follow a link in its text to another doc (it opens on the site, at the heading), "On this page" jumps to a section, "Edit this page on GitHub" opens the file on GitHub.
4. The theme switch in the docs header changes the theme and keeps it after a reload.
5. `/docs/no-such-page/`: the 404 page with "Go home" and "Read the docs".
6. Search: ⌘K (Ctrl+K) or the header's "Search docs" opens the dialog; "workspace" lists results; ↓ and Enter open one; Esc closes. Also from the 404 page.
7. `GET /robots.txt` lists the disallowed paths and the sitemap in production, `Disallow: /` elsewhere; `GET /sitemap-index.xml` answers 200 in production.

Expected: no console errors; `/` is the same page signed in and out.
Mail: none.

### Health

Guide: [how-to-monitor-health.md](../../../../docs/guides/how-to-monitor-health.md).

1. `GET /health/live`: `200 {"status":"pass"}`.
2. `GET /health/ready` and `/health`: `200` with `application/health+json`, status `pass` (or `warn` with the check named), `releaseId` the deployed version.

Expected: no error text, hostnames or binding names in the public body. (The smoke suite checks the same.)
Mail: none.

### Security headers

Guide: [how-to-configure-security-headers.md](../../../../docs/guides/how-to-configure-security-headers.md).

1. `curl -sI <url>/` and `curl -sI <url>/api/hello`: `Content-Security-Policy`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy` on both; the page's policy has `script-src <url>/_astro/ 'sha256-…'`, the API's is `default-src 'none'; …`.
2. `curl -sI <url>/favicon.svg` and `<url>/_storybook/`: the same headers from `_headers`; Storybook's policy has `frame-ancestors 'self'`.
3. During every section above, the suite's CSP guard sees no violation (it fails the journey); afterwards Workers Logs has no `csp.violation` for the app's own origin, Turnstile or the R2 bucket (browser extensions' are noise).
4. `curl -sI <url>/sign-in` and `<url>/docs/`: `Cache-Control` contains `no-transform`; with `WEB_ANALYTICS=none` no page's HTML holds a `cloudflareinsights` script even though the zone's Web Analytics automatic setup may be on ([Edge-injected Web Analytics](../../../../docs/reference/security-headers.md#check-it); the smoke suite checks it too).

Expected: `CSP_MODE=enforce` in production (`bun run doctor`).
Mail: none.

### Themes and mobile width

1. Repeat the landing, sign-in, dashboard, members, settings and admin overview pages in the dark and the light theme (Settings → Appearance, or the OS setting signed out).
2. At a 375 px viewport: the app shell's menu collapses, nothing scrolls sideways, dialogs fit.

Expected: text readable in both themes (the smoke suite runs axe on the public pages in both).
Mail: none.

### Cleanup

Every run ends by erasing its accounts, automatically (the global teardown, `cleanupRun`, through the [QA cleanup endpoint](#the-qa-cleanup)):

1. Each account of the run (`qa+<runId>-<role>@`), with the shared workspaces only run accounts use: the real erasure.
2. The mail **Your account was deleted** is in the outbox, and sign-in with the old credentials is refused (the example journey checks both for its own account, erased through Settings → Privacy → **Delete account**).
3. In CI, the `qa` job erases them again in a step of its own that runs even when the suite failed or was killed ([CI](#ci)). Accounts a killed local run left are erased by the [nightly cleanup](#nightly-cleanup).

To look for leftovers by hand, use the admin portal (`/admin/users`, search `@qa.flooper.me`) or a read-only query:

```bash
cd apps/web && bunx wrangler d1 execute cloudflare-starter-production --remote --env production \
  --command "SELECT id, email, created_at FROM user WHERE email LIKE 'qa+%@qa.flooper.me'"
```

Never delete users with SQL: it skips the erasure of their files, exports and avatars ([how-to-handle-data-privacy.md](../../../../docs/reference/data-privacy.md#erasure-and-retained-data)).

Mail: **Your account was deleted** (to each account, in the outbox).

## Run record

For manual checks and failures; copy into the PR or release notes:

| Section                  | Result | Notes |
| ------------------------ | ------ | ----- |
| Smoke suite              |        |       |
| Sign-up and verification |        |       |
| Sign-in and sign-out     |        |       |
| Password reset           |        |       |
| Two-factor               |        |       |
| Passkeys                 |        |       |
| Workspaces               |        |       |
| Files                    |        |       |
| Billing                  |        |       |
| Notifications            |        |       |
| Settings                 |        |       |
| Trash                    |        |       |
| Privacy                  |        |       |
| Admin portal             |        |       |
| MCP                      |        |       |
| Notes and Tasks          |        |       |
| Dashboard and system     |        |       |
| Demos                    |        |       |
| Landing, docs and search |        |       |
| Health                   |        |       |
| Security headers         |        |       |
| Themes and mobile width  |        |       |
| Cleanup                  |        |       |

## Keeping it current

`test/architecture/qa-checklist.test.ts` fails when a guide in `docs/guides/` is neither linked from this checklist nor exempt with a reason (setup, operations or build-time guides). A new user-facing feature gets a section here with steps, the expected result and the mail it sends, and a journey in `apps/web/test/qa/` that does them ([Writing a journey](#writing-a-journey)).
