# How to use the audit log

What the audit log records (who did what to what, when, with which outcome, from where), how a state change records an event, what metadata may carry, how long events are kept, how to read them, and how the fields map to OCSF for an export. Use when you add a use case that changes state, add an action to the catalog, look up who did something, change the retention, or plan an export, archive or tamper evidence.

## What it is

The `audit` feature (`packages/features/src/audit/`) keeps one D1 table, `audit_events`, that is **append-only**: `recordAuditEvent` is the only code that inserts, `purgeAuditEvents` the only code that deletes (past retention), and nothing updates a row. `test/architecture/audit-coverage.test.ts` enforces this. Better Auth has no audit log of its own, so its endpoints are recorded from hooks.

The audit log is not the application log. Logs ([how-to-setup-logging.md](how-to-setup-logging.md)) are for operating the service and are sampled, rotated and vendor-shaped; audit events are business records of security-relevant actions, kept for a fixed period and queried by actor, target and workspace. They share the trace id: every event carries the `trace_id` of the request, queue message or cron run that caused it, so the logs of that work are one search away.

## What is recorded

| Action                            | Recorded by                                          | Target       | Metadata                                                                     |
| --------------------------------- | ---------------------------------------------------- | ------------ | ---------------------------------------------------------------------------- |
| `auth.sign_in`                    | `databaseHooks.session.create.after` (auth-audit.ts) | `user`       | `method` (password, social, sign_up, email_verification, other), `provider?` |
| `auth.sign_in_failed`             | `hooks.after` on `/sign-in/email` answering an error | `email`      | `method: password`, `reason` (Better Auth error code)                        |
| `auth.sign_up`                    | `databaseHooks.user.create.after`                    | `user`       | `method` (password, social, other), `provider?`                              |
| `auth.password_reset_requested`   | `hooks.after` on `/request-password-reset`           | `email`      | none                                                                         |
| `user.role_changed`               | admin portal                                         | `user`       | `previousRole`, `role`                                                       |
| `user.banned`                     | admin portal                                         | `user`       | `reason?`, `expiresAt?`                                                      |
| `user.unbanned`                   | admin portal                                         | `user`       | none                                                                         |
| `user.sessions_revoked`           | admin portal                                         | `user`       | `sessionCount?`                                                              |
| `user.deleted`                    | admin portal                                         | `user`       | none                                                                         |
| `impersonation.started`           | admin portal                                         | `user`       | none                                                                         |
| `impersonation.stopped`           | admin portal                                         | `user`       | none                                                                         |
| `workspace.invitation_created`    | workspace use cases                                  | `invitation` | `email`, `role`                                                              |
| `workspace.invitation_accepted`   | workspace use cases                                  | `invitation` | `role`                                                                       |
| `workspace.invitation_revoked`    | workspace use cases                                  | `invitation` | none                                                                         |
| `workspace.member_role_changed`   | workspace use cases                                  | `user`       | `previousRole`, `role`                                                       |
| `workspace.member_removed`        | workspace use cases                                  | `user`       | `role?`                                                                      |
| `workspace.ownership_transferred` | workspace use cases                                  | `workspace`  | `previousOwnerUserId`, `ownerUserId`                                         |
| `workspace.deleted`               | workspace use cases                                  | `workspace`  | none                                                                         |

The catalog is `auditEventSchema` in `packages/features/src/audit/domain/audit-event.ts`. The admin and workspace actions are defined ahead of the features that record them. A sign-up that opens a session records both `auth.sign_up` and `auth.sign_in` (`method: sign_up`). Any other endpoint that opens a session (a password change re-issues one) records `auth.sign_in` with `method: other`. Sign-in and sign-up hooks fail open: if the insert fails, the error is reported ([how-to-setup-error-reporting.md](how-to-setup-error-reporting.md)) and the sign-in still succeeds.

Each row: `id`, `occurred_at` (ms), `action`, `outcome` (`success` or `failure`), `actor_user_id`, `actor_kind` (`user`, `admin`, `system`), `impersonator_user_id`, `target_type`, `target_id`, `workspace_id`, `trace_id`, `source` (`http`, `queue`, `cron`), `ip`, `metadata` (JSON). There are no foreign keys: events outlive the users and workspaces they name. Indexes: `(occurred_at)`, `(actor_user_id, occurred_at)`, `(target_type, target_id)`, `(workspace_id, occurred_at)`.

## Recording an event from a use case

A use case that changes state calls `recordAuditEvent` after the change succeeded, with the request context it was given:

```ts
import { recordAuditEvent } from "../audit";

await recordAuditEvent(deps, context, {
  action: "workspace.member_role_changed",
  workspaceId,
  target: { type: "user", id: memberUserId },
  metadata: { previousRole: "member", role: "admin" },
});
```

- The context supplies `trace_id`, `source`, `ip`, and by default the actor (`context.userId` as a `user`, or `system` when there is none) and `workspace_id`. Pass `actor` to record an `admin`, or an admin acting as a user (`impersonatorUserId`).
- `outcome` defaults to `success`; record refused or failed attempts that matter for security with `outcome: "failure"`.
- An invalid event throws `InvalidAuditInputError` (a `DomainError`, `invalid_input`), so a mistake fails the use case's tests instead of silently writing nothing.
- D1 has no interactive transactions: the event is a second statement after the change. If a project needs the change and its event to commit together, build both statements and send them in one `db.batch([...])`.
- Features listed in `AUDITED_FEATURES` in `test/architecture/audit-coverage.test.ts` must call `recordAuditEvent` from every use case that inserts, updates or deletes, or list the use case in `AUDIT_EXEMPT` with a reason. Add a new feature to `AUDITED_FEATURES` when it is created.
- Code that runs inside a library and cannot take the context as an argument (Better Auth hooks) reads it with `currentRequestContext()` from `apps/web/src/server/request-scope.ts`; `withRequestContext` in `server/http.ts` runs every request in that scope.

## Adding an action

1. Add a member to the discriminated union in `domain/audit-event.ts`: `action` literal, `target` type, and a `.strict()` metadata object (`noMetadata` when there is none). Workspace actions spread `inWorkspace`.
2. Add a valid example to `VALID` in `domain/audit-event.test.ts`; the tests then check it is accepted, that undeclared keys and the wrong target are rejected, and that no key looks like a credential.
3. Add a row to the table above and to the OCSF mapping below.
4. Name actions `<area>.<past_tense_verb>` (`user.banned`), never rename one that has been recorded (old rows keep the old name), and add rather than change metadata fields.

## Metadata rules

- Only fields declared in the catalog: the `.strict()` schemas reject everything else, so a request body, a token or a password cannot be passed through.
- Keys matching `token`, `password`, `secret` or `code` (case-insensitive, at any depth) are refused (`domain/redact.ts`); a test fails if the catalog declares one. Name a field for what it means instead (`reason`, not `errorCode`).
- Record identifiers and the values a reviewer needs (old and new role), not whole objects. Personal data stays minimal: an email only where the target is an address (failed sign-in, reset request, invitation).
- Strings are capped at 200 characters, ids at 320.

## Reading the log

`listAuditEvents({ db }, filters)` returns events newest first, a page at a time: filters `actorUserId`, `action`, `targetType` and `targetId`, `workspaceId`, `from` (inclusive) and `to` (exclusive) as ISO 8601; `limit` (1 to 200, default 50); `cursor` from the previous page's `nextCursor`. Pagination is keyset on `(occurred_at, id)`, so pages do not shift while events are added. `auditQuerySchema` is the input schema for any procedure that exposes it.

No tRPC procedure or MCP tool reads the log yet; the admin portal adds them (with their MCP tools, per the parity rule). Until then, query D1 directly:

```bash
cd apps/web
bunx wrangler d1 execute DB --local --command \
  "SELECT occurred_at, action, outcome, actor_user_id, target_type, target_id, trace_id, ip, metadata FROM audit_events ORDER BY occurred_at DESC LIMIT 20"
```

Use `--remote --env <env>` for a deployed environment. To see what else happened during an event, search the logs for its `trace_id` ([how-to-setup-logging.md](how-to-setup-logging.md)).

## Retention

`AUDIT_RETENTION_DAYS` in `packages/features/src/audit/domain/retention.ts` is 400 days: a yearly review plus a margin. Change the constant to keep events longer or shorter (some regulations ask for several years; then also consider an archive, below). The cron schedule `17 3 * * *` (daily, 03:17 UTC, `AUDIT_PURGE_CRON` in `apps/web/src/server/cron.ts`, in `triggers.crons` of every environment) runs `purgeAuditEvents`, which deletes events older than the cutoff in batches of 500 and logs `cron.audit_purge` with the count and the cutoff. Run it locally:

```bash
bun run dev:web    # in another terminal
curl "http://localhost:4321/cdn-cgi/handler/scheduled?cron=17+3+*+*+*"
```

## Options not built

- **Archive to R2.** Before the purge deletes them, write the expiring events as NDJSON (one OCSF-mapped object per line) to an R2 bucket per day, for long-term retention at low cost. A new use case in `audit/`, called from the purge cron before `purgeAuditEvents`.
- **Tamper evidence.** Append-only is enforced in code, not in D1: anyone with database access can still change rows. A hash chain makes changes detectable: each row stores `hash = sha256(previous_hash || canonical_json(row))`, and a verifier recomputes the chain. Concurrent writers need a single sequencer (a Durable Object) to order the chain. Periodically anchoring the latest hash outside D1 (the R2 archive, an external log) makes rewriting the whole chain detectable too.
- **Full OCSF.** Events are stored in our own compact shape; an export maps them (below).

## OCSF mapping

Fields follow the [Open Cybersecurity Schema Framework](https://schema.ocsf.io/) (OCSF) so an export to a SIEM is a mapping, not a redesign. Check class and activity ids against the OCSF version the SIEM uses.

| Column                     | OCSF attribute                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| `id`                       | `metadata.uid`                                                                                   |
| `occurred_at`              | `time` (epoch ms)                                                                                |
| `action`                   | `class_uid` and `activity_id` (table below); the action name in `metadata.labels`                |
| `outcome`                  | `status_id`: 1 Success, 2 Failure; `status_detail` from `metadata.reason`                        |
| `actor_user_id`            | `actor.user.uid`                                                                                 |
| `actor_kind`               | `actor.user.type`: User, Admin, System                                                           |
| `impersonator_user_id`     | `actor.invoked_by` (the admin acting as the user)                                                |
| `target_type`, `target_id` | `user.uid` / `user.email_addr` (user, email), `group.uid` (workspace), `entity.uid` (invitation) |
| `workspace_id`             | `group.uid` for workspace actions; `unmapped.workspace_id` otherwise                             |
| `trace_id`                 | `metadata.correlation_uid` (the W3C trace id; also `trace.uid`)                                  |
| `source`                   | `unmapped.source`                                                                                |
| `ip`                       | `src_endpoint.ip`                                                                                |
| `metadata`                 | `unmapped` (and the class-specific attributes noted below)                                       |

| Action                                                             | OCSF class                    | Activity                                        |
| ------------------------------------------------------------------ | ----------------------------- | ----------------------------------------------- |
| `auth.sign_in`, `auth.sign_in_failed`                              | Authentication (3002)         | 1 Logon; `auth_protocol` from `metadata.method` |
| `auth.sign_up`                                                     | Account Change (3001)         | 1 Create                                        |
| `auth.password_reset_requested`                                    | Account Change (3001)         | 4 Password Reset                                |
| `user.role_changed`                                                | User Access Management (3005) | 1 Assign Privileges (or 2 Revoke Privileges)    |
| `user.banned`, `user.unbanned`                                     | Account Change (3001)         | 5 Disable, 2 Enable                             |
| `user.sessions_revoked`                                            | Authentication (3002)         | 2 Logoff                                        |
| `user.deleted`                                                     | Account Change (3001)         | 6 Delete                                        |
| `impersonation.started`, `impersonation.stopped`                   | Authentication (3002)         | 1 Logon, 2 Logoff, with `actor` the admin       |
| `workspace.invitation_created`, `workspace.invitation_revoked`     | Entity Management (3004)      | 1 Create, 4 Delete                              |
| `workspace.invitation_accepted`                                    | Group Management (3006)       | 3 Add User                                      |
| `workspace.member_role_changed`, `workspace.ownership_transferred` | Group Management (3006)       | 1 Assign Privileges                             |
| `workspace.member_removed`                                         | Group Management (3006)       | 4 Remove User                                   |
| `workspace.deleted`                                                | Group Management (3006)       | 5 Delete                                        |
