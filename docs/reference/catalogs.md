# Catalogs

::reviewed{date="2026-11-08"}

The lists the app is built from, generated from the code by `bun run docs:reference`: rate limits, audit actions, notifications, feature flags, product analytics events, background jobs and schedules. Each catalog is a composition root in `packages/features/src`; an architecture test fails when a feature uses something that is not in its catalog.

## Rate limits

From `abuse/domain/policies.ts`. Every mutation has a policy (the default is `mutation.user`); how to tune one: [abuse protection](../guides/how-to-configure-abuse-protection.md).

<!-- generated:rate-limits -->

| Policy                      | Limit      | Per  | Enforced by | Covers                                                                                                                                                                                                                                                                                     |
| --------------------------- | ---------- | ---- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth.two-factor`           | 10 / 60 s  | ip   | better-auth | Second-factor attempts; account lockout also applies                                                                                                                                                                                                                                       |
| `auth.otp-send`             | 3 / 60 s   | ip   | better-auth | Email recovery-code sends                                                                                                                                                                                                                                                                  |
| `auth.passkey`              | 20 / 60 s  | ip   | better-auth | Passkey ceremonies and management                                                                                                                                                                                                                                                          |
| `auth.ip`                   | 60 / 60 s  | ip   | edge        | Every /api/auth/* request, per IP, before Better Auth runs                                                                                                                                                                                                                                 |
| `auth.sign-in`              | 10 / 60 s  | ip   | better-auth | Sign-in attempts (password guessing)                                                                                                                                                                                                                                                       |
| `auth.sign-up`              | 5 / 60 s   | ip   | better-auth | Account creation                                                                                                                                                                                                                                                                           |
| `auth.change-email`         | 3 / 60 s   | ip   | better-auth | Account email change requests                                                                                                                                                                                                                                                              |
| `auth.delete-user`          | 3 / 3600 s | ip   | better-auth | Account deletion attempts                                                                                                                                                                                                                                                                  |
| `auth.password-reset`       | 3 / 60 s   | ip   | better-auth | Password reset mails                                                                                                                                                                                                                                                                       |
| `auth.verification-email`   | 3 / 60 s   | ip   | better-auth | Verification mails on request (Resend link on the check-inbox screens). Anonymous callers may name any address, so it is limited per IP; no human check: our screens only resend to the address just signed up or signed in with (both behind the human check) or the signed-in user's own |
| `auth.oauth-register`       | 5 / 3600 s | ip   | better-auth | Dynamic OAuth client registration (MCP clients)                                                                                                                                                                                                                                            |
| `auth.oauth-token`          | 10 / 60 s  | ip   | better-auth | OAuth token exchange and refresh                                                                                                                                                                                                                                                           |
| `auth.oauth-authorize`      | 10 / 60 s  | ip   | better-auth | OAuth authorization requests                                                                                                                                                                                                                                                               |
| `mutation.user`             | 60 / 60 s  | user | edge        | Every tRPC mutation without a more specific policy                                                                                                                                                                                                                                         |
| `upload.user`               | 20 / 60 s  | user | edge        | File uploads: POST /api/files and storage.createUpload                                                                                                                                                                                                                                     |
| `mcp.ip`                    | 600 / 60 s | ip   | edge        | Every /mcp request, per IP, before the token is verified (MCP clients share server IPs)                                                                                                                                                                                                    |
| `mcp.user`                  | 120 / 60 s | user | edge        | Every /mcp request, per token user; tool calls that mutate also count against their mutation policy                                                                                                                                                                                        |
| `token.lookup`              | 30 / 60 s  | ip   | edge        | Pages that look up a token from the URL (invitation links), per IP, against guessing                                                                                                                                                                                                       |
| `notifications.unsubscribe` | 20 / 60 s  | ip   | edge        | One-click unsubscribe POSTs from mail links (RFC 8058), per IP: anonymous, authorized by a signed token                                                                                                                                                                                    |
| `billing.webhook`           | 300 / 60 s | ip   | edge        | The billing provider's webhook (POST /api/billing/webhook), per IP, before the signature is checked                                                                                                                                                                                        |
| `invitation.send`           | 10 / 60 s  | user | edge        | Invitations a user sends (mail to other people)                                                                                                                                                                                                                                            |
| `container.run`             | 3 / 60 s   | user | edge        | Container workflow demo runs a user starts (containerRuns.start): each starts a billed container                                                                                                                                                                                           |
| `analytics.client`          | 120 / 60 s | user | edge        | Client analytics batches (analytics.track), per user; kept apart from mutation.user so telemetry never uses up a user's mutations                                                                                                                                                          |
| `health.ip`                 | 120 / 60 s | ip   | edge        | The public health endpoints (/health, /health/live, /health/ready), per IP: anonymous, and readiness queries D1 and R2 on each call                                                                                                                                                        |
| `csp.report`                | 30 / 60 s  | ip   | edge        | Content-Security-Policy violation reports (/api/csp-report), per IP: anonymous and each report is a log line                                                                                                                                                                               |
| `qa.bypass`                 | 30 / 60 s  | ip   | edge        | Requests that carry the QA token (x-qa-token): on a human-checked auth endpoint, and every request to /api/qa/outbox and /api/qa/cleanup; per IP, counted before the token is compared (QA_BYPASS=on only)                                                                                 |

<!-- /generated:rate-limits -->

## Audit actions

From `audit/domain/audit-event.ts`. Every state-changing use case records one: [the audit log](../guides/how-to-use-the-audit-log.md).

<!-- generated:audit-actions -->

| Area            | Actions                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `account`       | `account.avatar_removed`, `account.avatar_updated`, `account.session_revoked`, `account.settings_updated`                                                                                                                                                                                                                                                                                          |
| `admin`         | `admin.test_email_sent`                                                                                                                                                                                                                                                                                                                                                                            |
| `auth`          | `auth.factor_changed`, `auth.human_check_failed`, `auth.password_changed`, `auth.password_reset_requested`, `auth.second_factor_verified`, `auth.sign_in`, `auth.sign_in_failed`, `auth.sign_up`                                                                                                                                                                                                   |
| `billing`       | `billing.addons_set`, `billing.override_set`, `billing.plan_assigned`, `billing.plan_lapsed`, `billing.subscription_changed`, `billing.trial_started`                                                                                                                                                                                                                                              |
| `container_run` | `container_run.finished`, `container_run.started`                                                                                                                                                                                                                                                                                                                                                  |
| `demo`          | `demo.account_erased`, `demo.deletion_warned`                                                                                                                                                                                                                                                                                                                                                      |
| `feature_flag`  | `feature_flag.rules_changed`, `feature_flag.updated`                                                                                                                                                                                                                                                                                                                                               |
| `impersonation` | `impersonation.oauth_refused`, `impersonation.started`, `impersonation.stopped`                                                                                                                                                                                                                                                                                                                    |
| `mcp`           | `mcp.client.authorized`, `mcp.client.revoked`                                                                                                                                                                                                                                                                                                                                                      |
| `note`          | `note.commented`, `note.created`, `note.updated`                                                                                                                                                                                                                                                                                                                                                   |
| `notifications` | `notifications.preferences_changed`, `notifications.unsubscribed`                                                                                                                                                                                                                                                                                                                                  |
| `privacy`       | `privacy.export_ready`, `privacy.export_requested`, `privacy.user_erased`                                                                                                                                                                                                                                                                                                                          |
| `qa`            | `qa.admin.demoted`, `qa.admin.promoted`, `qa.bypass.used`                                                                                                                                                                                                                                                                                                                                          |
| `storage`       | `storage.reconciliation_page`, `storage.reconciliation_requested`                                                                                                                                                                                                                                                                                                                                  |
| `trash`         | `trash.item_purged`, `trash.item_restored`, `trash.item_trashed`                                                                                                                                                                                                                                                                                                                                   |
| `user`          | `user.banned`, `user.deleted`, `user.password_reset_sent`, `user.role_changed`, `user.second_factor_reset`, `user.sessions_revoked`, `user.unbanned`                                                                                                                                                                                                                                               |
| `workspace`     | `workspace.created`, `workspace.deleted`, `workspace.invitation_accepted`, `workspace.invitation_created`, `workspace.invitation_revoked`, `workspace.logo_removed`, `workspace.logo_updated`, `workspace.member_joined`, `workspace.member_left`, `workspace.member_removed`, `workspace.member_role_changed`, `workspace.owner_assigned`, `workspace.ownership_transferred`, `workspace.updated` |

<!-- /generated:audit-actions -->

## Notifications

From `notification-catalog.ts`, in the order of the preferences screen: [notifications](../guides/how-to-send-notifications.md).

<!-- generated:notifications -->

| Type                       | Shown as                                      | In the app | Email | Security notice |
| -------------------------- | --------------------------------------------- | ---------- | ----- | --------------- |
| `container-runs.finished`  | A container run you started finishes          | yes        | no    | no              |
| `workspaces.member-joined` | Someone joins a workspace you manage          | yes        | yes   | no              |
| `workspaces.role-changed`  | Your role in a workspace changes              | yes        | yes   | no              |
| `auth.password-changed`    | Your password changes                         | yes        | yes   | yes             |
| `auth.new-sign-in`         | Someone signs in from a new browser or device | yes        | yes   | yes             |
| `auth.factor-changed`      | Your sign-in security changes                 | yes        | yes   | yes             |
| `privacy.export-ready`     | Your data export is ready                     | yes        | yes   | yes             |
| `demo.deletion-warning`    | Your demo account is about to be deleted      | yes        | yes   | yes             |

<!-- /generated:notifications -->

## Feature flags

From `feature-flags/domain/catalog.ts`: [feature flags](../guides/how-to-use-feature-flags.md).

<!-- generated:flags -->

| Flag                    | Type    | Default | In the browser | What it does                                                                                       | Remove when                                                                 |
| ----------------------- | ------- | ------- | -------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `upload-demo-presigned` | boolean | `true`  | yes            | Shows the presigned (browser to R2) upload card next to the Worker upload on the upload demo page. | the upload demo keeps a single upload path, or both paths are kept for good |

<!-- /generated:flags -->

## Product analytics events

From `analytics-events.ts`. Pseudonymous ids only, no personal data: [product analytics](../guides/how-to-setup-product-analytics.md).

<!-- generated:events -->

| Event                               | Sent from | What happened                                                                                    |
| ----------------------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| `auth.signed_up`                    | server    | An account was created; how (password, social provider)                                          |
| `files.uploaded`                    | server    | A file was stored in a workspace through the Worker; its category and size                       |
| `notes.created`                     | server    | A note was created in a workspace; the bucket of its body length                                 |
| `container_runs.started`            | server    | A container workflow demo run was started; its digits preset and whether it retries a failed run |
| `workspaces.created`                | server    | A workspace was created (personal at sign-up, or shared)                                         |
| `workspaces.member_joined`          | server    | A user joined a workspace: by accepting an invitation, or at sign-up in single mode              |
| `app.page_viewed`                   | browser   | A page of the /app SPA was shown (route pattern only)                                            |
| `app.command_palette_opened`        | browser   | The command palette opened (shortcut or trigger)                                                 |
| `app.command_palette_item_selected` | browser   | A command palette item was picked (its kind only)                                                |

<!-- /generated:events -->

## Jobs and schedules

From `job-catalog.ts` and `cron-catalog.ts`: [background jobs](../guides/how-to-add-background-jobs.md).

<!-- generated:jobs -->

**Jobs**

| Job                           |
| ----------------------------- |
| `audit.purge-events`          |
| `billing.expire-trials`       |
| `container-runs.purge`        |
| `demo.enforce-retention`      |
| `demo.seed-workspace`         |
| `demo.warn-account`           |
| `files.cleanup-storage`       |
| `files.retry-cleanup`         |
| `greetings.hello`             |
| `jobs.purge-idempotency-keys` |
| `notifications.dispatch`      |
| `notifications.plan-digests`  |
| `notifications.purge`         |
| `notifications.send-digest`   |
| `notifications.send-email`    |
| `privacy.build-export`        |
| `privacy.purge-exports`       |
| `qa-outbox.purge`             |
| `storage.reconcile`           |
| `trash.purge-expired`         |

**Schedules** (UTC)

| Schedule                      | When         |
| ----------------------------- | ------------ |
| `files.retry-cleanup`         | `17 * * * *` |
| `privacy.purge-exports`       | `17 * * * *` |
| `audit.purge-events`          | `17 3 * * *` |
| `jobs.purge-idempotency-keys` | `17 3 * * *` |
| `billing.expire-trials`       | `17 3 * * *` |
| `notifications.purge`         | `17 3 * * *` |
| `notifications.plan-digests`  | `0 8 * * *`  |
| `qa-outbox.purge`             | `17 3 * * *` |
| `trash.purge-expired`         | `17 3 * * *` |
| `demo.enforce-retention`      | `17 3 * * *` |
| `storage.reconcile`           | `17 3 * * *` |
| `container-runs.purge`        | `17 3 * * *` |

<!-- /generated:jobs -->
