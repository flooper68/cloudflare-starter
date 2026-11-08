# How to QA a deployment

The scripted feature check of a deployed environment (production: <https://starter.flooper.me>). Use when you release to production or staging, after a change to auth, email, workspaces, billing, notifications, storage, privacy or the admin portal, or when you plan a QA run with an agent in the owner's browser.

Quality on a deployment has three layers:

| Layer               | What                                                                                              | Where                                                                                                         | Who                             |
| ------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Automated E2E       | Every critical journey against `astro dev` with local bindings                                    | `bun run test:e2e` locally and in CI ([testing.md](../architecture/testing.md#e2e-tests))                     | CI                              |
| Production smoke    | What a signed-out visitor sees: pages, redirects, endpoints, headers, axe in both themes, console | `bun run test:smoke -- --base-url https://starter.flooper.me`; the Deploy workflow runs it after every deploy | CI, anyone                      |
| Scripted feature QA | This checklist: every feature with real accounts, real mail and real Turnstile                    | The owner's real Chrome (Claude in Chrome), plus-addressed Gmail accounts                                     | The coordinator, with the owner |

The smoke suite never signs up and never writes (it aborts any non-GET request to the app). Everything that needs an account is here.

Most of this checklist also runs unattended as Playwright journeys, one file per section, that create their own `qa-<run>-*` accounts and erase them at the end: `bun run test:qa -- --base-url <url>` ([apps/web/test/qa/README.md](../../apps/web/test/qa/README.md) maps sections to files and lists what it skips and why). The steps below stay the reference for what each journey asserts, and for the parts it cannot do (real passkeys and authenticator apps on the owner's device, the next day's digest, Claude itself).

## Rules for a run

- **Accounts.** Only plus-addressed QA accounts: `premysl.ciompa+qa-<run>-a@gmail.com` (owner A) and `premysl.ciompa+qa-<run>-b@gmail.com` (invitee B), where `<run>` is the date and a letter, e.g. `20261106a`. Mail to them lands in the owner's Gmail inbox (check Spam too). Never use the owner's own account for anything but the [admin](#admin-portal) section.
- **Passwords** are generated for the run and kept in the owner's password manager; the agent never types one it read from a page, and never stores one in the repository or the chat.
- **Turnstile and CAPTCHAs.** The widget usually passes on its own in a real browser. If it shows an interactive challenge, the owner solves it; the agent never does.
- **Owner present** for steps marked _(owner)_: passkeys (device biometrics), authenticator codes, anything that asks for the owner's own password or second factor.
- **Production is shared.** Do not change feature flags, settings or plans of anything but the QA workspaces. Do not load-test or trip rate limits on purpose (sign-up allows 5 per minute per IP).
- **Mail sender** is `starter@flooper.me` ("Cloudflare Starter"). For every mail, check it arrived, the sender, the subject, that links point at the environment's origin, and (for notifications) the `List-Unsubscribe` header (Gmail: Show original).
- **Record** each section as pass, fail (with a screenshot and the reference/trace id shown in the error) or N/A (with the reason) in the [run record](#run-record).

Before the run: the Deploy workflow's smoke job passed (or run `bun run test:smoke -- --env production`), and note the deployed version (`releaseId` in `GET /health/ready`).

## Sign-up and email verification

Guides: [how-to-setup-auth.md](how-to-setup-auth.md), [how-to-configure-workspaces.md](how-to-configure-workspaces.md), [how-to-configure-abuse-protection.md](how-to-configure-abuse-protection.md), [how-to-setup-email.md](how-to-setup-email.md).

1. Open `/sign-up`. The Human check (Turnstile) widget appears and passes.
2. Sign up account A with name `QA <run> A`: **Check your inbox** names A's address.
3. Press **Resend link** once: "Sent." shows. (Pressing it four times within a minute shows the rate-limit wait; do not do that on production.)
4. Sign in as A before opening the mail: the same **Check your inbox** card shows instead of an error.
5. Open the newest verification mail and follow its link: **Email verified**, then **Continue to the app**.
6. Open `/email-verified?error=INVALID_TOKEN`: **This link doesn't work** with **Send a new link**.
7. Repeat steps 1, 2 and 5 for account B in a separate browser profile or incognito window (keep it for B's steps below).

Expected: before verification, sign-in shows the check-inbox card; after the link, the person lands in `/app/dashboard` with a personal workspace on a trial plan, and the dashboard's **Get started** list shows "Verify your email" done.
Mail: **Verify your email** (to each account, once more after Resend).

## Sign-in and sign-out

1. Sign out (profile menu, the avatar at the bottom of the sidebar → Sign out); you land on `/`.
2. Sign in as A at `/sign-in` with a wrong password: refused, no hint whether the email exists.
3. Sign in with the right password.

Expected: `/app/dashboard`; `/app` signed out redirects to `/sign-in`; the audit log (admin section) has the failed and the successful sign-in.
Mail: **New sign-in to your account** when the sign-in is from a new browser or device.

## Password reset

1. Sign out, open `/forgot-password`, enter A's email (Turnstile passes).
2. Follow the reset link, choose a new password (update the password manager).
3. Sign in with the old password (refused) and the new one (works).

Expected: the reset page says a mail was sent whether or not the account exists; the link works once.
Mail: **Reset your password**, then **Your password was changed** (a security notice, also in the inbox).

## Two-factor: authenticator, backup codes, email code

Guide: [how-to-configure-account-security.md](how-to-configure-account-security.md).

1. _(owner)_ Settings → Security → set up an authenticator: scan the QR (or use the manual key) and confirm a six-digit code with the current password.
2. Save the recovery codes in the password manager.
3. Sign out and sign in: `/two-factor` asks for a code. Enter one from the authenticator.
4. Sign out and sign in with a recovery code instead. Use the same code again on the next sign-in: refused.
5. Sign out and sign in choosing the emailed code; enter the code from the mail.
6. Regenerate recovery codes: the old ones stop working.

Expected: each factor completes sign-in once; a wrong code is refused (ten failures lock verification for 15 minutes, so do not try that on production).
Mail: **Your account security changed** on enrollment and regeneration; **Your verification code** for the emailed code.

## Passkeys

1. _(owner)_ Settings → Security → add a passkey, name it `QA <run>`.
2. Sign out, sign in with the passkey.
3. Because A has an authenticator, the second factor is still asked for.
4. Rename and then remove the passkey.

Expected: the passkey appears in the list with its name; sign-in works; removal takes it off the list.
Mail: **Your account security changed** on add and remove.

## Workspaces: create, switch, invite, accept, roles, leave, transfer

Guide: [how-to-configure-workspaces.md](how-to-configure-workspaces.md).

1. As A, create a workspace `QA <run> shared` (workspace menu → Create workspace) and switch between it and the personal workspace with the switcher.
2. Members → Invite people: invite B as **member**.
3. As B, open the invitation mail link (`/invite/<token>`) and accept.
4. As A, change B's role to **admin**; then transfer ownership to B.
5. As B (now owner), transfer ownership back to A.
6. As B, leave the workspace.

Expected: the switcher shows both workspaces; B sees the shared workspace only after accepting; A gets an unread badge for B joining; role changes show on the Members page at once; after leaving, B no longer sees the workspace and A's Members page no longer lists B.
Mail: **QA <run> A invited you to QA <run> shared** (to B); **member joined** (to A); **role changed** (to B).

## Files: both upload paths and limits

Guides: [how-to-setup-r2.md](how-to-setup-r2.md), [how-to-configure-plans-and-billing.md](how-to-configure-plans-and-billing.md).

1. As A in `QA <run> shared`, open `/app/upload-demo`. Upload a small PNG through the **binding** card.
2. Upload another through the **presigned URL** card (direct to R2). If it reports a configuration error, presigned uploads are not configured for the environment: N/A.
3. Open each file's link: it downloads the same bytes.
4. Limits: in the [billing](#billing-manual-mode-and-admin-override) section's override, set the workspace's storage limit to 1 MB, then upload a 2 MB file.

Expected: both files are listed with size and type; over the limit the upload is refused before any bytes are stored, with an upgrade prompt naming the limit.
Mail: none.

## Billing: manual mode and admin override

Guide: [how-to-configure-plans-and-billing.md](how-to-configure-plans-and-billing.md). Production runs `BILLING=manual`.

1. As A, open `/app/billing`: the trial plan, its end date and usage meters; no checkout (manual mode).
2. As the owner's admin account, open `/admin/workspaces` → `QA <run> shared` → Billing: assign a plan, set an add-on, set a storage-limit override of 1 MB with reason `QA <run>` (used by [files](#files-both-upload-paths-and-limits)).
3. Remove the override and set the plan back.

Expected: A's billing page reflects each change after a reload; overridden limits are marked **Override**; every change appears in the audit log as `billing.*`.
Mail: none.

## Notifications: inbox, email, digest, unsubscribe

Guide: [how-to-send-notifications.md](how-to-send-notifications.md).

1. As A, open the bell: the notifications produced so far (member joined, password changed, security changes). Open one, mark it read, mark it unread, archive one.
2. `/app/notifications/preferences`: set **member joined** to email as a **daily digest**; try to turn off a security notice (it cannot be turned off).
3. Trigger one more member notification (invite and accept a third QA address, or B re-joins) and check the next day's digest after 08:00 UTC. If the run cannot wait, mark the digest check deferred and finish it the next day.
4. In a notification mail, use the footer's unsubscribe link: `/unsubscribe` confirms with one click; the preference shows as off.

Expected: the badge count matches the unread items; the digest groups the day's items in one mail; unsubscribe needs no sign-in and changes only that type.
Mail: the notification mails above; **digest** (next day); none after unsubscribing.

## Settings: profile, avatar, email change, sessions, connected accounts

Guides: [how-to-use-settings.md](how-to-use-settings.md), [how-to-define-branding.md](how-to-define-branding.md) (appearance only).

1. Settings → Account: change the name; upload an avatar (PNG under the size limit), then remove it.
2. Change the email to `premysl.ciompa+qa-<run>-a2@gmail.com`, confirm from the mail, sign in with the new address.
3. Settings → Security: sessions lists this browser and B's incognito session if A signed in there; revoke the other one (that browser is signed out on its next request).
4. Connected accounts: lists the email/password method (and Google if it is enabled for the environment).
5. Settings → Appearance: dark, light and system theme; the change persists after a reload.

Expected: the header avatar and name update at once; an oversize or non-image avatar is refused.
Mail: **Confirm email change** (to the new address).

## Trash: delete, restore, purge

Guide: [how-to-use-trash.md](how-to-use-trash.md).

1. Delete one of the uploaded files: it leaves the file list and appears in `/app/trash`.
2. Restore it: it is back in the list and downloads.
3. Delete it again and **delete forever** from the trash (owner only).

Expected: the trash shows who deleted what and when; a member cannot delete forever; the purged file's link answers 404.
Mail: none.

## Privacy: export download and account erasure

Guide: [how-to-handle-data-privacy.md](how-to-handle-data-privacy.md).

1. As A, Settings → Privacy → Export your data (personal), and as owner the workspace export of `QA <run> shared`.
2. Wait for **ready** (reload), download the ZIP from the Privacy page, the inbox and the bell. Open it: `manifest.json`, `data/…` NDJSON, the uploaded files under `files/`; no password hashes, tokens or recovery codes.
3. Account erasure is the [cleanup](#cleanup) at the end of the run.

Expected: each download is the same archive; the signed link opened signed out (or as B) answers 404.
Mail: **Your data export is ready** (one per export).

## Admin portal

Guides: [how-to-use-admin-portal.md](how-to-use-admin-portal.md), [how-to-use-the-audit-log.md](how-to-use-the-audit-log.md), [how-to-use-feature-flags.md](how-to-use-feature-flags.md), [how-to-monitor-health.md](how-to-monitor-health.md). As the owner's admin account _(owner)_; act only on the QA accounts and workspaces.

1. `/admin/overview`: counts include the QA accounts; the Health card shows every check passing (or warn, with a reason).
2. Users: search `qa-<run>`, open B: sign-in methods, workspaces, sessions (no tokens).
3. Suspend B with reason `QA <run>`: B's open session ends and B's sign-in is refused. Lift the suspension: B signs in again.
4. Impersonate A: the impersonation banner shows; stop impersonating returns to the admin.
5. `/admin/audit`: filter by A and by B: sign-ins, the suspension, the impersonation, workspace and billing changes of the run, each with a trace id.
6. `/admin/flags`: the flags list opens. Do not change production flags; to test a change, add a rule that targets only `QA <run> shared` and remove it again.
7. `/admin/workspaces`: `QA <run> shared` with its members and billing panel.
8. `/admin/data-requests`: the run's export requests.
9. `/admin/settings`: read-only values match `wrangler.jsonc` production vars.

Expected: destructive actions ask for a recent sign-in (and the admin's second factor when enrolled); an admin cannot act on their own account.
Mail: **Your password was changed** or security notices only if those actions are taken; none for suspension.

## MCP: connect Claude and call a tool

Guide: [how-to-setup-mcp.md](how-to-setup-mcp.md).

1. In Claude (claude.ai → Settings → Connectors) add a custom connector `https://starter.flooper.me/mcp`.
2. Sign in as A (not the owner's account). The consent page names Claude, A's address and `claude.ai`, lists what it may do in plain words (use the tools as you, see your name and email, stay connected) and says where to revoke it; click Allow.
3. Ask Claude to call `whoami`, then `list_workspaces` and `list_files` for `QA <run> shared`.
4. Ask Claude to call `list_connected_agents`: Claude is listed with `thisConnection: true`.
5. Settings → Connected agents: Claude is listed with the date it was connected, its permissions in plain words and the browser that approved it. Click **Disconnect**, confirm; the next tool call fails and Claude asks to connect again. Remove the connector from Claude.

Expected: the tools answer as A with A's workspaces only; A's audit log shows the tool calls' changes, none for reads, plus `mcp.client.authorized` and `mcp.client.revoked`.
Mail: possibly **New sign-in to your account** for the consent sign-in.

## Placeholder apps: Notes and Tasks

Guide: [how-to-add-a-feature.md](how-to-add-a-feature.md).

1. As A in `QA <run> shared`, sidebar → **Notes**: the Placeholder badge and notice show; with no notes, **No notes yet** with **New note**.
2. Create a note `QA <run> note`, edit its body, add a comment.
3. As B (a member), open the note and comment too; search the list for its title.
4. Move it to the trash: it leaves the list; Trash lists it as `QA <run> note`; restore it: it is back with both comments.
5. Sidebar → **Tasks**: the sample board; switch to the list; reload: the sample data starts over.
6. Admin portal → audit log: `note.created`, `note.updated`, `note.commented`, `trash.item_trashed`, `trash.item_restored` for the note, without its text.

Expected: the dashboard's "Write your first note" step is done after step 2; Billing → Usage shows Notes against the plan's limit (Free 50, Pro unlimited).
Mail: none.

## Dashboard and system screens

Guides: [how-to-configure-workspaces.md](how-to-configure-workspaces.md), [how-to-configure-account-security.md](how-to-configure-account-security.md).

1. As A, `/app/dashboard`: **Get started** lists Verify your email (done), Invite a teammate, Turn on two-factor authentication, Write your first note, each open step with its button; the count matches.
2. After the workspace steps above (B joined, A has an authenticator), the list shows those steps done.
3. As B (a member of `QA <run> shared`), open `/app/settings/workspace`: **You don't have access to this**, naming A as the owner, and **Back to dashboard**.
4. Open `/app/no-such-page`: **Page not found** inside the app shell.
5. DevTools → Network → Offline: the **You're offline.** strip appears at the top of the app; **Try again** keeps it; back online, it goes away.

Expected: no blank areas, no raw errors; the 403 and 404 views keep the sidebar.
Mail: none.

## Command palette

Guide: [how-to-add-a-feature.md](how-to-add-a-feature.md#navigation-and-the-command-palette).

1. As A on `/app/dashboard`, press ⌘K (Ctrl+K): the palette opens with the search focused and the groups Navigate, Workspaces (multi mode) and Actions.
2. Type part of `QA <run> note`'s title: it shows under **Notes** (briefly "Searching notes…"); Enter opens it. A note in the trash is never listed.
3. ⌘K, type `Settings`, Enter: **Account settings** opens. ↑ ↓, Home and End move the selection.
4. Click **Search** in the top bar, press Esc: the palette closes and focus is back on Search. Type `zzzz`: **No results for "zzzz"**.
5. As B (a member of `QA <run> shared`): ⌘K lists no **Settings: Workspace**, no **Invite member** and no **Admin**. As the admin, **Admin** is listed.
6. At phone width (DevTools device mode): the trigger is a search icon without a key hint; the palette fills the screen with **Cancel**.

Expected: works in both themes; selecting **Switch to the light theme** switches and remembers it after a reload.
Mail: none.

## Demos: queue and email

Guides: [how-to-add-background-jobs.md](how-to-add-background-jobs.md), [how-to-setup-email.md](how-to-setup-email.md).

1. Dashboard → **Developer demos** (`/app/demos`) lists Upload, Queue and Email.
2. `/app/queue-demo`: enqueue a hello job; it shows as processed.
3. `/app/email-demo`: send the test email to A.

Expected: the job completes within a minute; the mail arrives.
Mail: **[production] Starter kit test email**.

## Landing, docs and search

Guide: [how-to-publish-docs-and-landing.md](how-to-publish-docs-and-landing.md).

1. `/`: the hero, the feature cards, "Built on" and the three steps; the header's Sign in and Open app (signed in, it opens the dashboard; signed out, sign-in), Read the docs, View on GitHub.
2. `/_storybook/` opens the component library.
3. `/docs/`: the docs index with the navigation; open a guide from the navigation, follow a link in its text to another doc (it opens on the site, at the heading), "On this page" jumps to a section, "Edit this page on GitHub" opens the file on GitHub.
4. The theme switch in the docs header changes the theme and keeps it after a reload.
5. `/docs/no-such-page/`: the 404 page with "Go home" and "Read the docs".
6. Search: ⌘K (Ctrl+K) or the header's "Search docs" opens the dialog; "workspace" lists results; ↓ and Enter open one; Esc closes. Also from the 404 page.
7. `GET /robots.txt` lists the disallowed paths and the sitemap in production, `Disallow: /` elsewhere; `GET /sitemap-index.xml` answers 200 in production.

Expected: no console errors (DevTools); `/` is the same page signed in and out.
Mail: none.

## Health

Guide: [how-to-monitor-health.md](how-to-monitor-health.md).

1. `GET /health/live`: `200 {"status":"pass"}`.
2. `GET /health/ready` and `/health`: `200` with `application/health+json`, status `pass` (or `warn` with the check named), `releaseId` the deployed version.

Expected: no error text, hostnames or binding names in the public body. (The smoke suite checks the same.)
Mail: none.

## Security headers

Guide: [how-to-configure-security-headers.md](how-to-configure-security-headers.md).

1. `curl -sI <url>/` and `curl -sI <url>/api/hello`: `Content-Security-Policy`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy` on both; the page's policy has `script-src <url>/_astro/ 'sha256-…'`, the API's is `default-src 'none'; …`.
2. `curl -sI <url>/favicon.svg` and `<url>/_storybook/`: the same headers from `_headers`; Storybook's policy has `frame-ancestors 'self'`.
3. During every section above, DevTools shows no "violates the following Content Security Policy directive" message; afterwards Workers Logs has no `csp.violation` for the app's own origin, Turnstile or the R2 bucket (browser extensions' are noise).
4. `curl -sI <url>/sign-in` and `<url>/docs/`: `Cache-Control` contains `no-transform`; with `WEB_ANALYTICS=none` no page's HTML holds a `cloudflareinsights` script even though the zone's Web Analytics automatic setup may be on ([Edge-injected Web Analytics](how-to-configure-security-headers.md#check-it); the smoke suite checks it too).

Expected: `CSP_MODE=enforce` in production (`bun run doctor`).
Mail: none.

## Themes and mobile width

1. Repeat the landing, sign-in, dashboard, members, settings and admin overview pages in the dark and the light theme (Settings → Appearance, or the OS setting signed out).
2. Resize the browser to 375 px wide: the app shell's menu collapses, nothing scrolls sideways, dialogs fit.

Expected: text readable in both themes (the smoke suite runs axe on the public pages in both).
Mail: none.

## Cleanup

Every run ends by erasing its accounts:

1. As B, then as A: Settings → Account → **Delete account** (password and a fresh sign-in). A owns `QA <run> shared`: delete that workspace first (Settings → Workspace) or the erasure refuses while A is its last owner.
2. Check the mail and that sign-in with the old credentials is refused.
3. Remove the Claude connector and the passkey from the owner's device; delete the run's recovery codes and passwords from the password manager.

Fallback, as the owner's admin account _(owner)_: `/admin/users` → search `qa-<run>` → Delete account (browser only, behind the destructive-action gate; it runs the same erasure). Find leftovers of earlier runs with a read-only query:

```bash
cd apps/web && bunx wrangler d1 execute cloudflare-starter-production --remote --env production \
  --command "SELECT id, email, created_at FROM user WHERE email LIKE 'premysl.ciompa+qa-%'"
```

Never delete users with SQL: it skips the erasure of their files, exports and avatars ([how-to-handle-data-privacy.md](how-to-handle-data-privacy.md#erasure-and-retained-data)).

Mail: **Your account was deleted** (to each account).

## Run record

Copy into the PR or release notes:

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

`test/architecture/qa-checklist.test.ts` fails when a guide in `docs/guides/` is neither linked from this checklist nor exempt with a reason (setup, operations or build-time guides). A new user-facing feature gets a section here with steps, the expected result and the mail it sends.
