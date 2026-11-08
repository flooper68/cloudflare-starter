# How to run a public demo

Demo mode turns a deployment into a public demo that anyone may sign up to: a notice says accounts are deleted after a few days, new workspaces get sample notes, and a daily job warns each account a day before it is due and then erases it through the real privacy erasure. Use this guide when you turn demo mode on or off, change the retention, protect an account from it, look at its counters, or debug an account that was (or was not) deleted. The starter's production (`https://starter.flooper.me`) runs it so the public site's "Try the demo app" can point at the real app.

**Apps built from the starter normally keep `DEMO_MODE=off` everywhere.** Demo mode exists for the starter's own public instance; a product has real users whose accounts must never expire. It is starter-only and can be removed (see [Removing demo mode](#removing-demo-mode)).

> **Starter-only, removed by `starter:strip`** (`demo-mode`): the starter's staging and production run as a public demo; the strip sets `DEMO_MODE` off in every environment, and the code stays inert ([how-to-start-a-project.md](how-to-start-a-project.md)).

## Settings

All in the `vars` of each environment in `apps/web/wrangler.jsonc` (locally `apps/web/.dev.vars`). Parsed by `parseDemoConfig` (`apps/web/src/lib/config.ts`); a missing or invalid one fails every request with an error naming it, the `settings:configuration` check of `/health/ready` fails (the admin view of the check names the setting), and `bun run doctor` reports it per environment.

| Setting                 | Values                              | Required                 | What it does                                                                                                                                                  |
| ----------------------- | ----------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEMO_MODE`             | `off` \| `on`                       | yes, no default          | With `off` nothing below is read and nothing of this guide happens                                                                                            |
| `DEMO_RETENTION_DAYS`   | whole number, 2 to 365              | with `on`                | Accounts are erased this many days after sign-up (at the first daily run after that, and only once warned)                                                    |
| `DEMO_SAMPLE_DATA`      | `on` \| `off`                       | with `on`                | A new personal workspace gets the sample notes                                                                                                                |
| `DEMO_PROTECTED_EMAILS` | comma-separated addresses, up to 50 | no (read only with `on`) | Accounts never erased (case-insensitive), besides platform admins and `BOOTSTRAP_ADMIN_EMAIL`. Put the owner's other accounts here                            |
| `QA_EMAIL_DOMAIN`       | hostname (the QA bypass's setting)  | no                       | When set, accounts in that exact domain are neither warned nor erased: the automated QA suite erases its own accounts ([QA guide](how-to-qa-a-deployment.md)) |

**Before turning it on over an existing deployment:** list every account to keep in `DEMO_PROTECTED_EMAILS` (the owner's own accounts that are not platform admins or `BOOTSTRAP_ADMIN_EMAIL`). The first daily run warns every other account older than `DEMO_RETENTION_DAYS − 1` days (as many as the next run can erase, 100) and the next run erases them.

What the starter ships: develop `off` (the playground keeps its data), staging `on` (rehearses the retention before production), production `on` with 7 days and sample data. Admins see the values on `/admin/settings` (**Demo mode**) and through `admin_get_settings`.

## What people see

- **Sign-up page:** above the form, before anyone signs up, the notice "Demo instance: your account and data are deleted after 7 days." with a link **Get the starter on GitHub**.
- **Every signed-in page of the app:** the same notice as a banner under the top bar (`DemoBanner` in `packages/ui`, rendered by `AppLayout`). Its × hides it for the browser session (sessionStorage key `demo-banner-dismissed`); it is back in the next session or another tab.
- **Sample notes:** right after sign-up, the queued job `demo.seed-workspace` writes three notes titled `Sample: …` (one with a comment) into the new personal workspace, through `createNote` and `addNoteComment`, so permissions, the plan's notes limit, `note.created` audit events and product events apply as for any note. It runs once per workspace (the job is keyed by workspace, and a workspace with any note, live or in the trash, is skipped). Nothing in single mode, which has no personal workspace. The Tasks placeholder needs no seed: its board is sample data in the browser for everyone.
- **The day before deletion:** the notification **Your demo account will be deleted tomorrow** (`demo.deletion-warning`, in the inbox and by email; security-critical, so it is always emailed at once and cannot be turned off), with a link to Settings › Privacy to export their data and the GitHub link.
- **After deletion:** the usual **Your account was deleted** mail of the privacy erasure.

## Retention rules

The cron entry `demo.enforce-retention` (daily, `17 3 * * *` UTC, `packages/features/src/cron-catalog.ts`) enqueues the job of the same name with the run's time as `asOf`; it enqueues nothing with `DEMO_MODE=off`. The job (`enforceDemoRetention`, `packages/features/src/demo/`) applies `demoRetentionDecision` to every account:

1. **Exempt, whatever its age:** platform admins (role contains `admin`), `BOOTSTRAP_ADMIN_EMAIL`, `DEMO_PROTECTED_EMAILS`, and `QA_EMAIL_DOMAIN` addresses (exact domain, not subdomains). All case-insensitive. Exempt accounts are filtered in SQL too, so they never use up a run's scan.
2. **Warning window:** an account at least `DEMO_RETENTION_DAYS − 1` days old that was never warned gets a `demo.warn-account` job (keyed by user). The job re-checks the rules, sends the notification and records `demo.deletion_warned` (actor `system`). An account with a current warning (recorded within the last 7 days, `DEMO_WARNING_VALID_MS`) is not warned again: the audit event is the record, the job key deduplicates deliveries and the notification's event id is stable, so a retried job dispatches nothing new. Each run warns no more accounts than the next run can erase, so "tomorrow" stays true for a backlog. At most 200 warnings per run.
3. **Erasure:** an account at least `DEMO_RETENTION_DAYS` old is erased only when it has a current warning recorded at least 12 hours before the run. A warning older than 7 days (the account was protected or an admin meanwhile) does not count: it is warned again first. An expired account that was never warned (demo mode just turned on, a missed run) is warned first and erased by the next day's run, so nobody is deleted without a warning, including when demo mode is turned on over existing accounts.
4. **How it erases:** `eraseDemoAccount` calls `eraseAccount` (privacy), the same path as the admin portal's erasure: `prepareUserErasure` (last-admin and last-owner checks first, then the personal workspace and every shared workspace the account was the only member of, with their files, logos, exports, avatars, identity references and audit redaction), then Better Auth's delete, whose hooks complete it (`privacy.user_erased`, the erasure record, the confirmation mail). It then records `demo.account_erased` (actor `system`, `metadata.retentionDays`). Never a raw delete.
5. **Batches and caps:** up to 20 erasures per job delivery, oldest accounts first; while more remain it enqueues the next batch with the same `asOf` (keyed by `asOf` and batch number), up to 5 batches, so at most 100 erasures a day. A backlog drains over the following days.
6. **Blocked accounts:** the last owner of a shared workspace that others still use is refused by the erasure's preflight before anything changes. The run logs `demo.erasure_blocked`, counts it as blocked, skips it in its later batches and tries again the next day; once the other members are gone (their own accounts expire) it is erased with the workspace. Any other failure is reported (`errors.capture`, `app.demo.operation: erase`) and tried again the next day; `ERASURE_BUSY` (another erasure in progress) retries the batch.

Everything is idempotent: an erased account is gone, warnings are recorded once, and each batch judges the same accounts as of the cron run.

## Admin overview

With `DEMO_MODE=on`, `/admin/overview` (and `admin.overview.get`, MCP `admin_get_overview`) shows a **Demo instance** card: **Active demo accounts** (accounts the retention applies to), **Deletions scheduled today** (of those, the ones whose `DEMO_RETENTION_DAYS` end by the end of the UTC day, overdue ones included; an unwarned one goes a day later) and **Deleted, last 7 days** (`demo.account_erased` events). `demo` is `null` with `off`.

## Debugging

- **Was an account warned or erased?** `/admin/audit`, filter by target user: `demo.deletion_warned`, then `privacy.user_erased` and `demo.account_erased`. Or the run's logs in Workers Logs: `demo.retention_batch` with `app.demo.warned`, `erased`, `blocked`, `failed` per batch.
- **An old account is still there:** it is exempt (admin, bootstrap, protected, QA domain), was warned less than 12 hours before the run, is blocked as a last owner (`demo.erasure_blocked`), or failed (an error report with `app.demo.operation: erase`).
- **Protect an account:** add it to `DEMO_PROTECTED_EMAILS` and deploy before it is erased; once removed from the list it is warned again first (unless it was warned in the last 7 days, which still counts).
- **No sample notes:** `DEMO_SAMPLE_DATA=off`, single mode, or the `demo.seed-workspace` job failed (error report; it retries with backoff). The plan's notes limit applies.

## Tests

| Test                                                    | Covers                                                                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `packages/features/src/demo/domain/retention.test.ts`   | The rules: age, warning window, admins, bootstrap, protected list, QA domain, the warning lead            |
| `packages/features/src/demo/*.integration.test.ts` (D1) | Seed (idempotent), warning (once), the retention run (right accounts, warned first, caps, blocked owners) |
| `apps/web/test/api/demo-mode.test.ts`                   | The real consumer, Better Auth's delete and its hooks, admin overview and settings, the SPA bootstrap     |
| `apps/web/test/e2e/demo/demo-mode.spec.ts`              | A sign-up in demo mode: the sign-up notice, the banner (dismissed per session), the sample notes          |
| `apps/web/test/e2e/smoke/public.smoke.ts` (demo notice) | The deployed sign-up page shows the notice exactly when the environment's `DEMO_MODE` is `on`             |

The demo E2E journey runs on a second dev server (Playwright project `demo`), started with the Node-only `E2E_DEMO_PORT` that `apps/web/test/e2e/demo-vite.mjs` turns into `DEMO_MODE=on` and its own local state; every other journey keeps `off`.

## Removing demo mode

A project that will never run a public demo can delete it. Starter-only pieces:

- Code: `packages/features/src/demo/`, `apps/web/src/server/demo.ts`, `apps/web/src/lib/demo-banner.ts` (and its test), `packages/ui/src/components/patterns/demo-banner.tsx` (and its stories), `apps/web/test/e2e/demo-vite.mjs`, `apps/web/test/e2e/demo/`, `apps/web/test/api/demo-mode.test.ts`, `packages/features/test/demo-fixtures.ts`.
- Wiring: the `demo.enforce-retention` cron entry, the three `demo.*` jobs in `job-catalog.ts`, `demoDeletionWarningNotification` in `notification-catalog.ts`, the `demo.*` audit actions, `demo` in `JobDeps`, `CronDeps`, `Platform`, the tRPC context, `AppConfig` and the SPA bootstrap, the `DemoNotice` of `AppLayout`, the sign-up page's notice, the demo card of `AdminOverview` and section of `AdminSettings`, `checkDemoVars` in `scripts/doctor.ts`, the demo smoke test and `SMOKE_DEMO_MODE` in `scripts/smoke.ts`, the `demo` Playwright project and its web server.
- Settings: `DEMO_MODE`, `DEMO_RETENTION_DAYS`, `DEMO_SAMPLE_DATA`, `DEMO_PROTECTED_EMAILS` in `wrangler.jsonc`, `.dev.vars.example` and `apps/web/test/api-bindings.ts`.
- Docs: this guide, its row in `docs/README.md`, the demo section of the QA checklist and the notes in the settings and privacy guides.

`eraseAccount`, `findLatestAuditTimes` and `countAuditEvents` are general and can stay. No table or migration belongs to demo mode.
