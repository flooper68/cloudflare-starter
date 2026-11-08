# How to QA a deployment

The automated QA suite of a deployed environment (production: <https://starter.flooper.me>) and the checklist it implements. Use when you release to production or staging, after a change to auth, email, workspaces, billing, notifications, storage, privacy or the admin portal, when you add or debug a QA journey, or when you set up the QA inbox, the QA bypass or the QA workflow.

Quality on a deployment has three layers:

| Layer            | What                                                                                              | Where                                                                                                         | Who                                            |
| ---------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Automated E2E    | Every critical journey against `astro dev` with local bindings                                    | `bun run test:e2e` locally and in CI ([testing.md](../architecture/testing.md#e2e-tests))                     | CI                                             |
| Production smoke | What a signed-out visitor sees: pages, redirects, endpoints, headers, axe in both themes, console | `bun run test:smoke -- --base-url https://starter.flooper.me`; the Deploy workflow runs it after every deploy | CI, anyone                                     |
| QA suite         | [The checklist](#the-checklist) below: every feature with real accounts and real mail             | `bun run test:qa -- --base-url https://starter.flooper.me`; the Deploy workflow runs it after the smoke suite | CI, with no human; two optional checks by hand |

The smoke suite never signs up and never writes (it aborts any non-GET request to the app). Everything that needs an account is the QA suite's.

## The automated suite

Playwright journeys in [apps/web/test/qa/](../../apps/web/test/qa/) (`*.qa.ts`, project `qa` of [apps/web/playwright.qa.config.ts](../../apps/web/playwright.qa.config.ts)) drive the deployed app in Chromium like a person: the real forms, the real mail, the real erasure. Nothing reads or writes the database directly.

```bash
QA_TOKEN=… QA_INBOX_URL=https://cloudflare-starter-qa-inbox.<account>.workers.dev QA_INBOX_TOKEN=… \
  bun run test:qa -- --base-url https://starter.flooper.me
```

Without `QA_TOKEN`, `QA_INBOX_URL` or `QA_INBOX_TOKEN` every journey skips and says which variable is missing (CI fails instead). The HTML report, traces, screenshots and videos of failures land in `apps/web/playwright-report/qa` and `apps/web/test-results/qa`.

How a run works:

- **Accounts.** Every account is `qa+<runId>-<role>@qa.flooper.me` (`QA_EMAIL_DOMAIN`): `<runId>` is the date and four random letters (`20261108kqzt`), one per `playwright test`, set by the global setup (`QA_RUN_ID`). Never the owner's own account.
- **Passwords** are generated in code from the address and the QA token (`support/password.ts`), so a later process can sign in again without storing them. They are never logged; CI scrubs them, and the token, from the report before uploading it.
- **Mail** goes to the [QA inbox](#the-qa-inbox); `inbox.waitFor` polls it. Links in a mail must point at the environment's origin, or the journey fails without following them.
- **Turnstile.** The browser loads a stub instead of Cloudflare's widget script, and every request to the app's origin (only that origin) carries `X-QA-Token`. For a QA address the server skips the Turnstile check and records `qa.bypass.used`; for any other address the check runs as for everyone ([the QA bypass](how-to-configure-abuse-protection.md#qa-bypass)).
- **One journey at a time, no retries.** Production is shared and limited per IP: sign-up allows 5 a minute, sign-in 10 a minute and account erasure 3 an hour. Do not load-test or trip limits on purpose.
- **Production is shared.** Journeys change feature flags, settings and plans of their own QA workspaces only.
- **Cleanup.** The global teardown erases every account the run created, whatever happened (`cleanupRun`): it signs in as each one, deletes the shared workspaces it owns, and deletes the account through Settings › Privacy. What it cannot erase (the erasure limit, a killed runner) the [nightly cleanup](#nightly-cleanup) erases.

Optional checks a person does by hand, because a headless browser cannot: _(human-only, optional)_

- **A real Turnstile challenge.** Open `/sign-up` in a normal browser: the widget appears and passes (or shows a challenge you solve), and a sign-up with a non-QA address works. The suite stubs the widget and the smoke suite only checks that its script and frame are allowed.
- **A real phone passkey.** The suite uses Chromium's virtual authenticator; adding a passkey from a phone (cross-device QR) and signing in with it needs the device.

Before a release: the Deploy workflow's smoke job passed (or run `bun run test:smoke -- --env production`), and note the deployed version (`releaseId` in `GET /health/ready`).

### Writing a journey

A journey is a `*.qa.ts` file in `apps/web/test/qa/` that imports from [support/](../../apps/web/test/qa/support/index.ts):

| Helper                                                                          | What it does                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `qaTest`, `expect`                                                              | Playwright's `test` with the E2E CSP guard; every context sends `X-QA-Token` to the app's origin only and loads the Turnstile stub. Fixture `runId`.                                                                      |
| `qaEnv()`                                                                       | `{ baseURL, token, inboxURL, inboxToken, emailDomain }` from `QA_BASE_URL`, `QA_TOKEN`, `QA_INBOX_URL`, `QA_INBOX_TOKEN` (and `QA_EMAIL_DOMAIN`); one error naming every missing one. `qaSkipReason()` for `qaTest.skip`. |
| `qaAddress(runId, role)`                                                        | `qa+<runId>-<role>@<QA_EMAIL_DOMAIN>`; `role` is lowercase letters and digits.                                                                                                                                            |
| `inbox.waitFor({ to, subject?, since, timeoutMs? })`                            | The newest mail to `to` since `since`: `{ subject, from, text, html, headers, links }`; `headers` has lowercase names (`list-unsubscribe`, `list-unsubscribe-post`). `inbox.clear(to)` deletes them.                      |
| `createVerifiedAccount(page, { role })`                                         | Signs up through the form, opens the verification mail's link, ends on the dashboard; returns `{ email, password }` and records the account for cleanup.                                                                  |
| `eraseQaAccount(browser, account)`, `cleanupRun(runId)`                         | Erasure through the real privacy flow, for one account or the whole run.                                                                                                                                                  |
| `open(page, path)`, `signIn(page, account)`, `callApp(page, kind, path, input)` | Navigation that waits for hydration, the sign-in form, and a tRPC call as the signed-in page makes it.                                                                                                                    |

Start every file with `qaTest.skip(qaSkipReason() !== null, qaSkipReason() ?? "")`, take `since` just before the action that sends mail, and never log a password or put one in an assertion message. [account-lifecycle.qa.ts](../../apps/web/test/qa/account-lifecycle.qa.ts) is the worked example (sign up → verify → dashboard → erase).

## The QA inbox

A small Worker of its own, `cloudflare-starter-qa-inbox` ([apps/qa-inbox/](../../apps/qa-inbox/src/index.ts)), receives the QA suite's mail. It has one mailbox, `qa@qa.flooper.me`, and every QA address is a subaddress of it (`qa+<runId>-<role>@qa.flooper.me`, RFC 5233):

- **Receiving.** One literal Email Routing rule, `qa@qa.flooper.me` → the Worker, with subaddressing on for the zone: Email Routing then matches `qa+<anything>@qa.flooper.me` to that rule and keeps the full address in `message.to`. The zone's catch-all is not used and not changed, so no other address of `flooper.me` behaves differently. The `email()` handler parses each mail (postal-mime) and stores recipient (with its `+tag`), sender, subject, date, text, HTML and every header in its own D1 database `cloudflare-starter-qa-inbox` (D1, not KV: reads are consistent a second after the write, from any location). Mail to another domain, over 1 MB or unparsable is rejected. It never forwards or replies.
- **Retention.** 24 hours: reads never return older mail, and an hourly cron deletes it.
- **API.** Bearer token `QA_INBOX_TOKEN` (its secret, compared in constant time), JSON, no CORS, no other routes: `GET /messages?to=<address>&since=<iso>&subject=<substring>` (newest first, at most 50) and `DELETE /messages?to=<address>`. `to` must be a run address `qa+<runId>-<role>@qa.flooper.me` (URL-encode the `+` as `%2B`); mail to any other address it receives (the QA admin's `qa+admin@`, plain `qa@`) is stored but never served.
- **Tests.** `bun run test` runs its project (`apps/qa-inbox/test`, Workers pool with its own wrangler.jsonc); `cd apps/qa-inbox && bunx wrangler deploy --dry-run` packages it.

Setup, once, by the owner (account changes):

```bash
bun run setup:qa-inbox --preflight # GET requests only: the zone's Email Routing as it is
bun run setup:qa-inbox --dry-run   # prints every command and API call; calls nothing
bun run setup:qa-inbox             # does it
```

It is idempotent. It starts with the read-only preflight (Email Routing on or off for the zone, subaddressing, the catch-all, every rule, the subdomain's records, the apex's MX records) and stops before changing anything when `qa@qa.flooper.me` is already routed somewhere else, or when Email Routing is off for the zone and the subdomain has no records yet (see below). Then:

| Step                     | How                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1                       | `wrangler d1 list --json`, else `wrangler d1 create cloudflare-starter-qa-inbox`; `wrangler d1 migrations apply INBOX --remote`                                                                         |
| Worker                   | `wrangler deploy` (in `apps/qa-inbox`)                                                                                                                                                                  |
| Secret                   | `wrangler secret put QA_INBOX_TOKEN` (value on stdin)                                                                                                                                                   |
| Email Routing, subdomain | Wrangler has no command for a subdomain: `POST /zones/<zone>/email/routing/dns {"name":"qa.flooper.me"}` with Wrangler's login (`wrangler auth token`) or `CLOUDFLARE_API_TOKEN`                        |
| Subaddressing            | No Wrangler command either: `PUT /zones/<zone>/email/routing {"support_subaddress":true}` (the dashboard's Email Routing > Settings > Subaddressing)                                                    |
| Rule                     | `wrangler email routing rules create flooper.me --name "QA inbox" --match-type literal --match-field to --match-value qa@qa.flooper.me --action-type worker --action-value cloudflare-starter-qa-inbox` |

DNS records it creates on `qa.flooper.me` (Cloudflare picks the MX priorities; `GET /zones/<zone>/email/routing/dns?subdomain=qa.flooper.me` shows them): MX `route1.mx.cloudflare.net`, MX `route2.mx.cloudflare.net`, MX `route3.mx.cloudflare.net`, and TXT `v=spf1 include:_spf.mx.cloudflare.net ~all`.

What it changes for the rest of `flooper.me`:

- **Subaddressing is a setting of the whole zone** (`support_subaddress` on `/zones/<zone>/email/routing`). With it on, every existing literal rule `name@flooper.me` also receives `name+anything@flooper.me`, which until then went to the catch-all. The preflight lists the rules that would gain subaddresses; when this was written the zone had none (Email Routing unconfigured, catch-all disabled).
- **The apex's MX records are never touched by default.** If Email Routing is off for the zone and `qa.flooper.me` has no records yet, the script stops: add the subdomain in the dashboard (Email > Email Routing > Settings > Subdomains) and run it again, or pass `--enable-zone-routing` only if replacing the MX records of `flooper.me` itself is fine.

Check it end to end by sending a mail to `qa+20260101test-check@qa.flooper.me` and reading it with `curl -H "Authorization: Bearer $QA_INBOX_TOKEN" "$QA_INBOX_URL/messages?to=qa%2B20260101test-check%40qa.flooper.me"`.

## CI

The workflow **QA** ([.github/workflows/qa.yml](../../.github/workflows/qa.yml)) has two jobs, on GitHub-hosted runners only:

- **`qa`** runs `bun run test:qa` against the deployed app. The Deploy workflow calls it after a production deploy whose smoke suite passed; Actions › QA › Run workflow runs it by hand. It takes an environment, never a URL: `bun run test:qa -- --env production` resolves the route in `apps/web/wrangler.jsonc`, so the QA token only goes to the repository's own routes. It fails when a secret is missing or any journey fails, scrubs the QA token and passwords from the report (`scripts/qa-scrub-artifacts.py`, which fails if anything is left) and uploads it as the artifact `qa-report-<run id>`.
- **`cleanup`** runs nightly at 03:37 UTC (and by hand with `cleanup` ticked): the [nightly cleanup](#nightly-cleanup).

Secrets, in the GitHub environment `qa` (Settings › Environments › New environment `qa`; deployment branches: `main` only; no required reviewers, so it runs unattended):

| Secret              | Value                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `QA_TOKEN`          | The same value as the production Worker secret `QA_TOKEN` (`openssl rand -hex 32`)       |
| `QA_INBOX_URL`      | The inbox Worker's URL, e.g. `https://cloudflare-starter-qa-inbox.<account>.workers.dev` |
| `QA_INBOX_TOKEN`    | The same value as the inbox Worker secret `QA_INBOX_TOKEN`                               |
| `QA_ADMIN_EMAIL`    | The QA admin's address (cleanup only), e.g. `qa+admin@qa.flooper.me`                     |
| `QA_ADMIN_PASSWORD` | The QA admin's password (cleanup only)                                                   |

### Nightly cleanup

`cleanup/leftovers.cleanup.ts` (project `qa-cleanup`) erases QA accounts that aborted runs left behind, through the admin portal's own API, never SQL: it signs in as the QA admin through the form (the bypass covers it: the address is in the QA domain), lists users matching `@qa.flooper.me` (`admin.users.list`), keeps only `qa+<runId>-<role>@…` addresses older than two hours that are not admins, deletes the shared workspaces each owns when every member is a QA account (`admin.workspaces.delete`), and erases each account (`admin.users.remove`, the same erasure as the portal's Delete account). It refuses to erase more than 50 in one night.

It needs a **QA admin**, set up once by the owner:

1. Sign up `qa+admin@qa.flooper.me` on production in a normal browser (the real Turnstile), with a long generated password kept in the password manager and the `QA_ADMIN_PASSWORD` secret. The inbox stores its verification mail but its API never serves it (only `qa+<runId>-<role>@` addresses), so read the link with your Cloudflare login: `cd apps/qa-inbox && bunx wrangler d1 execute cloudflare-starter-qa-inbox --remote --command "SELECT received_at, subject, text_body FROM messages WHERE recipient = 'qa+admin@qa.flooper.me' ORDER BY received_at DESC LIMIT 1"`.
2. As the owner, `/admin/users` → the QA admin → make them a platform admin. Do not enroll a second factor for it: destructive admin actions would then need one the job cannot give (and `TWO_FACTOR=required-for-admins` would stop the job; production runs `optional`).
3. It is a platform admin: whoever has its password can do what the admin portal does, so treat `QA_ADMIN_PASSWORD` as an admin credential. The job only ever erases `qa+<runId>-<role>@qa.flooper.me` accounts, and nobody can reset its password through the inbox API. Rotate the password, or remove the admin role, if the secret may have leaked.

## The checklist

The spec the journeys implement: each section is a journey (or part of one), with what it does, the expected result and the mail it checks. Steps marked _(human-only, optional)_ are not automated. Record a manual check, or a failed automated one, in the [run record](#run-record) as pass, fail (with the screenshot and the reference/trace id shown in the error) or N/A (with the reason).

For every mail: it arrived in the QA inbox, the sender is `starter@flooper.me` ("Cloudflare Starter"), the subject, links point at the environment's origin, and (for notifications) the `List-Unsubscribe` and `List-Unsubscribe-Post` headers. Accounts below: A (`qa+<runId>-a@qa.flooper.me`, owner), B (`qa+<runId>-b@qa.flooper.me`, invitee) in a separate browser context.

### Sign-up and email verification

Guides: [how-to-setup-auth.md](how-to-setup-auth.md), [how-to-configure-workspaces.md](how-to-configure-workspaces.md), [how-to-configure-abuse-protection.md](how-to-configure-abuse-protection.md), [how-to-setup-email.md](how-to-setup-email.md).

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

Guide: [how-to-configure-account-security.md](how-to-configure-account-security.md).

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

Guide: [how-to-configure-workspaces.md](how-to-configure-workspaces.md).

1. As A, create a workspace `QA <runId> shared` (workspace menu → Create workspace) and switch between it and the personal workspace with the switcher.
2. Members → Invite people: invite B as **member**.
3. As B, open the invitation mail link (`/invite/<token>`) and accept.
4. As A, change B's role to **admin**; then transfer ownership to B.
5. As B (now owner), transfer ownership back to A.
6. As B, leave the workspace.

Expected: the switcher shows both workspaces; B sees the shared workspace only after accepting; A gets an unread badge for B joining; role changes show on the Members page at once; after leaving, B no longer sees the workspace and A's Members page no longer lists B.
Mail: **QA <runId> A invited you to QA <runId> shared** (to B); **member joined** (to A); **role changed** (to B).

### Files: both upload paths and limits

Guides: [how-to-setup-r2.md](how-to-setup-r2.md), [how-to-configure-plans-and-billing.md](how-to-configure-plans-and-billing.md).

1. As A in `QA <runId> shared`, open `/app/upload-demo`. Upload a small PNG through the **binding** card.
2. Upload another through the **presigned URL** card (direct to R2). If it reports a configuration error, presigned uploads are not configured for the environment: N/A.
3. Open each file's link: it downloads the same bytes.
4. Limits: in the [billing](#billing-manual-mode-and-admin-override) section's override, set the workspace's storage limit to 1 MB, then upload a 2 MB file.

Expected: both files are listed with size and type; over the limit the upload is refused before any bytes are stored, with an upgrade prompt naming the limit.
Mail: none.

### Billing: manual mode and admin override

Guide: [how-to-configure-plans-and-billing.md](how-to-configure-plans-and-billing.md). Production runs `BILLING=manual`.

1. As A, open `/app/billing`: the trial plan, its end date and usage meters; no checkout (manual mode).
2. As the owner's admin account, open `/admin/workspaces` → `QA <runId> shared` → Billing: assign a plan, set an add-on, set a storage-limit override of 1 MB with reason `QA <runId>` (used by [files](#files-both-upload-paths-and-limits)).
3. Remove the override and set the plan back.

Expected: A's billing page reflects each change after a reload; overridden limits are marked **Override**; every change appears in the audit log as `billing.*`.
Mail: none.

### Notifications: inbox, email, digest, unsubscribe

Guide: [how-to-send-notifications.md](how-to-send-notifications.md).

1. As A, open the bell: the notifications produced so far (member joined, password changed, security changes). Open one, mark it read, mark it unread, archive one.
2. `/app/notifications/preferences`: set **member joined** to email as a **daily digest**; try to turn off a security notice (it cannot be turned off).
3. Trigger one more member notification (invite and accept a third QA address, or B re-joins) and check the next day's digest after 08:00 UTC. If the run cannot wait, mark the digest check deferred and finish it the next day.
4. In a notification mail, use the footer's unsubscribe link: `/unsubscribe` confirms with one click; the preference shows as off.

Expected: the badge count matches the unread items; the digest groups the day's items in one mail; unsubscribe needs no sign-in and changes only that type.
Mail: the notification mails above; **digest** (next day); none after unsubscribing.

### Settings: profile, avatar, email change, sessions, connected accounts

Guides: [how-to-use-settings.md](how-to-use-settings.md), [how-to-define-branding.md](how-to-define-branding.md) (appearance only).

1. Settings → Account: change the name; upload an avatar (PNG under the size limit), then remove it.
2. Change the email to `qa+<runId>-a2@qa.flooper.me`, confirm from the mail, sign in with the new address.
3. Settings → Security: sessions lists this browser context and a second one A signed in from; revoke the other one (that context is signed out on its next request).
4. Connected accounts: lists the email/password method (and Google if it is enabled for the environment).
5. Settings → Appearance: dark, light and system theme; the change persists after a reload.

Expected: the header avatar and name update at once; an oversize or non-image avatar is refused.
Mail: **Confirm email change** (to the new address).

### Trash: delete, restore, purge

Guide: [how-to-use-trash.md](how-to-use-trash.md).

1. Delete one of the uploaded files: it leaves the file list and appears in `/app/trash`.
2. Restore it: it is back in the list and downloads.
3. Delete it again and **delete forever** from the trash (owner only).

Expected: the trash shows who deleted what and when; a member cannot delete forever; the purged file's link answers 404.
Mail: none.

### Privacy: export download and account erasure

Guide: [how-to-handle-data-privacy.md](how-to-handle-data-privacy.md).

1. As A, Settings → Privacy → Export your data (personal), and as owner the workspace export of `QA <runId> shared`.
2. Wait for **ready** (reload), download the ZIP from the Privacy page, the inbox and the bell. Open it: `manifest.json`, `data/…` NDJSON, the uploaded files under `files/`; no password hashes, tokens or recovery codes.
3. Account erasure is the [cleanup](#cleanup) at the end of the run.

Expected: each download is the same archive; the signed link opened signed out (or as B) answers 404.
Mail: **Your data export is ready** (one per export).

### Admin portal

Guides: [how-to-use-admin-portal.md](how-to-use-admin-portal.md), [how-to-use-the-audit-log.md](how-to-use-the-audit-log.md), [how-to-use-feature-flags.md](how-to-use-feature-flags.md), [how-to-monitor-health.md](how-to-monitor-health.md). As the QA admin (the account of the [nightly cleanup](#nightly-cleanup)); act only on the QA accounts and workspaces of the run.

1. `/admin/overview`: counts include the QA accounts; the Health card shows every check passing (or warn, with a reason).
2. Users: search `qa+<runId>`, open B: sign-in methods, workspaces, sessions (no tokens).
3. Suspend B with reason `QA <runId>`: B's open session ends and B's sign-in is refused. Lift the suspension: B signs in again.
4. Impersonate A: the impersonation banner shows; stop impersonating returns to the admin.
5. `/admin/audit`: filter by A and by B: sign-ins, the suspension, the impersonation, workspace and billing changes of the run, each with a trace id.
6. `/admin/flags`: the flags list opens. Do not change production flags; to test a change, add a rule that targets only `QA <runId> shared` and remove it again.
7. `/admin/workspaces`: `QA <runId> shared` with its members and billing panel.
8. `/admin/data-requests`: the run's export requests.
9. `/admin/settings`: read-only values match `wrangler.jsonc` production vars.

Expected: destructive actions ask for a recent sign-in (and the admin's second factor when enrolled); an admin cannot act on their own account.
Mail: **Your password was changed** or security notices only if those actions are taken; none for suspension.

### MCP: connect Claude and call a tool

Guide: [how-to-setup-mcp.md](how-to-setup-mcp.md).

1. Connect an MCP client to `https://starter.flooper.me/mcp` the way Claude does: dynamic client registration, then OAuth authorization with PKCE in the browser. _(human-only, optional: the same with claude.ai → Settings → Connectors → custom connector.)_
2. Sign in as A. The consent page names the client, A's address and its redirect host, lists what it may do in plain words (use the tools as you, see your name and email, stay connected) and says where to revoke it; click Allow.
3. Call `whoami`, then `list_workspaces` and `list_files` for `QA <runId> shared`.
4. Call `list_connected_agents`: the client is listed with `thisConnection: true`.
5. Settings → Connected agents: the client is listed with the date it was connected, its permissions in plain words and the browser that approved it. Click **Disconnect**, confirm; the next tool call fails with an authorization error.

Expected: the tools answer as A with A's workspaces only; A's audit log shows the tool calls' changes, none for reads, plus `mcp.client.authorized` and `mcp.client.revoked`.
Mail: possibly **New sign-in to your account** for the consent sign-in.

### Placeholder apps: Notes and Tasks

Guide: [how-to-add-a-feature.md](how-to-add-a-feature.md).

1. As A in `QA <runId> shared`, sidebar → **Notes**: the Placeholder badge and notice show; with no notes, **No notes yet** with **New note**.
2. Create a note `QA <runId> note`, edit its body, add a comment.
3. As B (a member), open the note and comment too; search the list for its title.
4. Move it to the trash: it leaves the list; Trash lists it as `QA <runId> note`; restore it: it is back with both comments.
5. Sidebar → **Tasks**: the sample board; switch to the list; reload: the sample data starts over.
6. Admin portal → audit log: `note.created`, `note.updated`, `note.commented`, `trash.item_trashed`, `trash.item_restored` for the note, without its text.

Expected: the dashboard's "Write your first note" step is done after step 2; Billing → Usage shows Notes against the plan's limit (Free 50, Pro unlimited).
Mail: none.

### Dashboard and system screens

Guides: [how-to-configure-workspaces.md](how-to-configure-workspaces.md), [how-to-configure-account-security.md](how-to-configure-account-security.md).

1. As A, `/app/dashboard`: **Get started** lists Verify your email (done), Invite a teammate, Turn on two-factor authentication, Write your first note, each open step with its button; the count matches.
2. After the workspace steps above (B joined, A has an authenticator), the list shows those steps done.
3. As B (a member of `QA <runId> shared`), open `/app/settings/workspace`: **You don't have access to this**, naming A as the owner, and **Back to dashboard**.
4. Open `/app/no-such-page`: **Page not found** inside the app shell.
5. Take the browser offline: the **You're offline.** strip appears at the top of the app; **Try again** keeps it; back online, it goes away.

Expected: no blank areas, no raw errors; the 403 and 404 views keep the sidebar.
Mail: none.

### Command palette

Guide: [how-to-add-a-feature.md](how-to-add-a-feature.md#navigation-and-the-command-palette).

1. As A on `/app/dashboard`, press ⌘K (Ctrl+K): the palette opens with the search focused and the groups Navigate, Workspaces (multi mode) and Actions.
2. Type part of `QA <runId> note`'s title: it shows under **Notes** (briefly "Searching notes…"); Enter opens it. A note in the trash is never listed.
3. ⌘K, type `Settings`, Enter: **Account settings** opens. ↑ ↓, Home and End move the selection.
4. Click **Search** in the top bar, press Esc: the palette closes and focus is back on Search. Type `zzzz`: **No results for "zzzz"**.
5. As B (a member of `QA <runId> shared`): ⌘K lists no **Settings: Workspace**, no **Invite member** and no **Admin**. As the admin, **Admin** is listed.
6. At phone width (a 375 px viewport): the trigger is a search icon without a key hint; the palette fills the screen with **Cancel**.

Expected: works in both themes; selecting **Switch to the light theme** switches and remembers it after a reload.
Mail: none.

### Demos: queue and email

Guides: [how-to-add-background-jobs.md](how-to-add-background-jobs.md), [how-to-setup-email.md](how-to-setup-email.md).

1. Dashboard → **Developer demos** (`/app/demos`) lists API hello, Upload, Queue, Email and Containers.
2. `/app/queue-demo`: enqueue a hello job; it shows as processed.
3. `/app/email-demo`: send the test email to A.

Expected: the job completes within a minute; the mail arrives.
Mail: **[production] Starter kit test email**.

### Demos: containers (a workflow)

Guide: [how-to-run-container-workflows.md](how-to-run-container-workflows.md). Costs a container run: start at most two.

1. **Developer demos** → **Containers** → **Run a workflow** (`/app/container-demo`): the card says how many runs are left today and for A this hour.
2. Pick **10,000** and **Start run**: the timeline goes Queued, Starting container, Computing, Storing in R2, Notifying, Done, each with a time; a cold start takes a few seconds.
3. The result shows the first 100 digits (`3.14159265358979…`), the run duration and the compute time; **Download all 10,000 digits** saves a text file; the run is listed under **Past runs** as Succeeded.
4. The bell has **Container run finished: 10,000 digits of pi**, linking back to the run.
5. As B in another workspace, the run's link (`?run=<id>`) shows nothing of it.
6. Admin portal → audit log: `container_run.started` (A) and `container_run.finished` (system) for the run.
7. In an environment with `CONTAINER_DEMO=off` (staging ships off): the page says the demo is off and **Start run** is disabled.

Expected: the run succeeds within a minute; a failed run (the first minutes after a container deploy) shows the reason and **Retry**.
Mail: none (container notices are in-app unless A turned email on).

### Landing, docs and search

Guide: [how-to-publish-docs-and-landing.md](how-to-publish-docs-and-landing.md).

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

Guide: [how-to-monitor-health.md](how-to-monitor-health.md).

1. `GET /health/live`: `200 {"status":"pass"}`.
2. `GET /health/ready` and `/health`: `200` with `application/health+json`, status `pass` (or `warn` with the check named), `releaseId` the deployed version.

Expected: no error text, hostnames or binding names in the public body. (The smoke suite checks the same.)
Mail: none.

### Security headers

Guide: [how-to-configure-security-headers.md](how-to-configure-security-headers.md).

1. `curl -sI <url>/` and `curl -sI <url>/api/hello`: `Content-Security-Policy`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy` on both; the page's policy has `script-src <url>/_astro/ 'sha256-…'`, the API's is `default-src 'none'; …`.
2. `curl -sI <url>/favicon.svg` and `<url>/_storybook/`: the same headers from `_headers`; Storybook's policy has `frame-ancestors 'self'`.
3. During every section above, the suite's CSP guard sees no violation (it fails the journey); afterwards Workers Logs has no `csp.violation` for the app's own origin, Turnstile or the R2 bucket (browser extensions' are noise).
4. `curl -sI <url>/sign-in` and `<url>/docs/`: `Cache-Control` contains `no-transform`; with `WEB_ANALYTICS=none` no page's HTML holds a `cloudflareinsights` script even though the zone's Web Analytics automatic setup may be on ([Edge-injected Web Analytics](how-to-configure-security-headers.md#check-it); the smoke suite checks it too).

Expected: `CSP_MODE=enforce` in production (`bun run doctor`).
Mail: none.

### Themes and mobile width

1. Repeat the landing, sign-in, dashboard, members, settings and admin overview pages in the dark and the light theme (Settings → Appearance, or the OS setting signed out).
2. At a 375 px viewport: the app shell's menu collapses, nothing scrolls sideways, dialogs fit.

Expected: text readable in both themes (the smoke suite runs axe on the public pages in both).
Mail: none.

### Cleanup

Every run ends by erasing its accounts, automatically (the global teardown, `cleanupRun`):

1. As each account of the run (B, then A): delete the shared workspaces it owns (erasure refuses while it is the last owner of one with other members), then Settings → Privacy → **Delete account** with its password.
2. The mail **Your account was deleted** arrives, and sign-in with the old credentials is refused.
3. What could not be erased now (account erasure allows 3 an hour per IP) is erased by the [nightly cleanup](#nightly-cleanup).

To look for leftovers by hand, use the admin portal (`/admin/users`, search `@qa.flooper.me`) or a read-only query:

```bash
cd apps/web && bunx wrangler d1 execute cloudflare-starter-production --remote --env production \
  --command "SELECT id, email, created_at FROM user WHERE email LIKE 'qa-%@qa.flooper.me'"
```

Never delete users with SQL: it skips the erasure of their files, exports and avatars ([how-to-handle-data-privacy.md](how-to-handle-data-privacy.md#erasure-and-retained-data)).

Mail: **Your account was deleted** (to each account).

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
