# Data exports and account erasure

Use this guide when adding persisted data, handling an export or deletion request, connecting a payment provider, or restoring a database after an erasure. These are reusable product capabilities, not a claim of legal compliance for a consuming application.

## User and administrator flows

Settings → Privacy offers a personal export and, for an owner, an export of the current workspace. One request per subject may be active; at most three requests per subject are admitted in a rolling 24 hours, atomically in D1. The list shows queued, building, ready, failed and expired states; refresh it to see progress. A completion notification contains the signed download link; it works while signed in as the requesting person. Privacy settings can also issue the same expiring link. Download links are signed, require the same signed-in person, and expire 24 hours after completion. Every download rechecks current workspace export permission. A forwarded link cannot give another person access.

The archive contains `manifest.json`, whitelisted NDJSON tables under `data/<table>/<page>.ndjson`, and binary content under `files/<id>`, `profile/avatar` and `workspaces/<id>/logo`. A personal export contains the person's profile, linked-account/session metadata, preferences, memberships, own activity and personal-workspace content. Only metadata of their own files in shared workspaces is included; shared-workspace bytes require an owner workspace export. Missing or unfinished R2 uploads are listed explicitly under `missing-files/`. Password hashes, session/OAuth tokens, signing keys, verification secrets, TOTP secrets, backup codes, passkey credentials/public keys and secret-bearing notification payloads never enter the archive. Data is read over the build interval, not a transaction-wide snapshot.

`/admin/data-requests` lists request metadata and minimal erasure records. An administrator can request a user's personal export; it is delivered to the subject, never to the administrator. Erasure is an interactive browser action gated by the admin destructive-action guard, including recent sign-in and the configured second factor. The legacy `admin.users.remove` web alias uses the same erasure pipeline. Its former `admin_remove_user` MCP tool is removed deliberately: neither alias permits non-browser erasure. Self-service deletion remains Better Auth's password/fresh-session flow.

| Procedure                                              | MCP tool                                 |
| ------------------------------------------------------ | ---------------------------------------- |
| `privacy.requestExport`                                | `request_data_export`                    |
| `privacy.list`                                         | `list_data_exports`                      |
| `privacy.download`                                     | `get_data_export_download`               |
| `admin.privacy.list`                                   | `admin_list_data_requests`               |
| `admin.privacy.requestExport`                          | `admin_request_data_export`              |
| `admin.privacy.eraseUser`, legacy `admin.users.remove` | Browser only; explicit parity exemptions |

`GET /api/privacy/exports/[id]?expires=...&signature=...` streams the ZIP; it returns 404 for invalid, expired, cross-user or no-longer-authorized links and carries private/no-store, attachment, no-referrer and nosniff headers. Never log the signed query string.

The inbox and notification bell use native navigation for signed archive URLs so the browser receives the attachment. Only same-origin app/admin routes use SPA navigation; executable/non-HTTP schemes are rejected before rendering notification links. Completion delivery is asynchronous: reopening the inbox refreshes it. The privacy browser journey verifies both notification surfaces download the same valid ZIP as the Privacy page.

## Implementation and limits

`DATA_CATALOG` is the composition root. Each migration table declares its safe export columns, scope and erasure treatment or a reasoned retention/exclusion. Architecture tests require coverage and reject secret column projections. When a feature adds a table or external object, extend both this catalog and `buildErasureHandlers` as applicable; do not assume a foreign-key cascade removes R2 objects.

`privacy.build-export` is a queue job with a durable request/attempt lease. D1 reads use keyset pagination in ten-row pages; file bodies stream; the Zip port waits for its sink; R2 multipart buffers 5 MiB at a time. The fflate adapter uses stored entries to avoid recompressing binary data. The starter caps one archive at 1 GiB and 10,000 entries; exceeding either fails visibly and removes the partial archive. Increase limits only with load/runtime evidence. A job attempt must fit Cloudflare's [consumer wall-time/CPU limits](https://developers.cloudflare.com/queues/platform/limits/). The 20-minute attempt lease exceeds the documented 15-minute consumer wall-time; a retry after a crash aborts the recorded old multipart and starts a fresh unique key. It restarts the archive, rather than pretending an in-memory ZIP encoder can resume across Workers. The usual queue retry/DLQ policy applies.

An erasure lock prevents new exports and downloads while its subject is being erased. Admission rechecks that lock and the user's existence atomically. Failed cleanup retains the multipart/key for a later attempt and reports the error. A queue redelivery after a published export does not build a second archive. Unexpected failure responses are generic; internal object keys and multipart ids stay server-side.

## Storage expiry setup

`privacy.purge-exports` runs hourly at minute 17, invalidates expired downloads and removes completed/stale archives in bounded rounds. Permission expiry is exact at 24 hours even when physical cleanup is delayed. Use the independent R2 lifecycle backstop before deploying this feature:

```sh
bun run setup:privacy-storage --env all --dry-run
```

After the owner's explicit account-change approval, run without `--dry-run`. It adds the named `privacy-exports` rule only under `exports/`: completed objects expire after two days (enough for the full download window), incomplete multipart uploads abort after one day. It preserves other bucket rules. This is a one-time addition; inspect an existing rule before rerunning rather than adding another rule with the same id. The selected FILES bucket/environment and any jurisdiction come from `wrangler.jsonc`. Rule expiry is an operational backstop, not an exact deletion promise: [R2 lifecycle processing is asynchronous](https://developers.cloudflare.com/r2/buckets/object-lifecycles/). No lifecycle rule is installed merely by changing app code or running the dry run.

## Erasure and retained data

Both auth deletion hooks and admin deletion call the same preflight. The only active platform admin cannot self-delete; the last owner of a shared workspace with other members must transfer ownership. These checks run before R2/workspace/user changes. A short global serialization lease spans the auth before/after hooks so two account deletions cannot independently pass a stale last-admin check. The lease is owned by a private server-generated invocation token carried through the existing request bridge, not a user id or caller-provided trace. Only that invocation can re-enter/release it. Failed attempts can be retried after their owned cleanup releases it; a failed auth deletion may hold the lease until its 20-minute expiry.

The pipeline deletes the person's personal/sole-member workspaces and their live/trash files and logos, removes all avatar versions and prior export archives, leaves other shared workspaces, clears their invitations/verification records, and deletes credentials through Better Auth's gateway and foreign-key cascades (including factors and passkeys). Remaining shared records keep their content and null user attribution through existing FK contracts. It redacts the deleted subject's audit IP and email target/metadata values, while preserving action history and unrelated actors' events. The only audit updater is `redactAuditSubject`; tests restrict it to the permitted fields. Confirmation is sent through the Email port after erasure; a mail failure is reported and does not undo deletion.

**Billing decision, 2026-10-31:** this starter stores operational subscriptions, plan overrides, add-ons and usage, not invoices, payment transactions or tax records. Those operational rows are erased with a deleted workspace. No invented fiscal-retention ledger or duration is applied. A future payment adapter must explicitly define its financial record retention, authorization and export treatment.

The retained `erasure_records` row contains only user id, requested time and completion time, with no FK to the erased account, no email and no payload. Preserve an up-to-date copy outside a rollback target before D1 Time Travel/backup restoration; reapply erasure for those ids through the same pipeline before reopening service. Restoring an older database without this post-restore step can resurrect deleted data. The starter does not silently restore or erase a remote database for you.

Residual copies: D1 Time Travel and provider backups follow the account's configured retention; logs follow deployment retention; existing shared-workspace content belongs to that workspace; redacted audit history follows the configured audit retention; pseudonymous product analytics follows its provider retention. Consuming products must document their actual retention windows and legal policy. The minimal erasure ledger is retained to make the restoration procedure possible.

## Uploads already in flight when erasure starts

A binding upload writes through the Worker. After R2 accepts its bytes, `storeFile` rechecks the exact file id/key, including a trashed reference. If erasure removed that reference during the write, the upload is refused and its late object is deleted instead of reporting success. An exact cleanup intent is saved before cleanup; if R2 deletion or queue publication fails, the durable target survives in `pending_file_cleanup` and the queue/hourly dispatcher retries it. This does not depend on `STORAGE_RECONCILE`.

Already-issued presigned PUT URLs cannot be revoked by deleting D1 metadata. They remain usable for their existing 3,600-second signature window. Before workspace metadata disappears, erasure preserves that workspace's R2 prefix (including logos) and the person's `users/<id>/avatar/` prefix in the same non-cascading cleanup state. A late avatar write can fail its metadata FK after R2 accepts its bytes; the mandatory avatar-prefix sweeps remove those bytes too. Successful account deletion refreshes the deadline to one hour after deletion and publishes a delayed dispatcher. The first successful prefix sweep retains the intent and schedules a second mandatory sweep 24 hours later. Failed deletions, failed page continuations and queue outages retain the intent/cursor; an hourly dispatcher repairs missed publication independently of general reconciliation.

A workspace-prefix sweep deletes only when both the original user and workspace are absent; an avatar-prefix sweep requires the original user to be absent. Both protect current live or trashed file references. A partial auth failure therefore cannot cause a delayed task to purge a still-active user's prefix. Retrying erasure preserves old workspace IDs even when its first attempt already removed their metadata. Cleanup state is temporary and is removed only after the required sweeps succeed; it is not financial retention or job history.

These are physical-cleanup windows, not instant revocation. Application access is removed at account deletion, but a presigned request accepted just before expiry can finish after the first sweep. The second sweep handles later arrivals; an extremely slow request completing after that sweep, or sustained storage failures, can extend physical retention and require operator investigation/removal of the recorded old prefix. The starter does not claim cryptographic revocation of a URL it already issued or an unconditional instant-deletion guarantee.
