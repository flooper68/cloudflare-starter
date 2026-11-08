# How to use the audit log

::reviewed{date="2026-11-09"}

The audit log records who did what to what, when, with which outcome and from where, append-only, for 400 days. Use this guide when a use case changes state, when you add an action, or when you look up who did something. The audit log is not the application log: it keeps business records of security-relevant actions, and shares the trace id with the logs. Every action: [Catalogs › Audit actions](../reference/catalogs.md#audit-actions).

::flow[Use case changes state -> recordAuditEvent -> audit_events -> Admin › Audit]{title="Audit flow: a use case changes state, records an event, and admins read it in the portal"}

## Record an event from a use case

:::steps
1. **After the change succeeded**, call `recordAuditEvent(deps, context, { action, workspaceId, target, metadata })`. The context supplies the actor, trace id, source and IP.
2. **A new action?** Add a member to the union in `packages/features/src/audit/domain/audit-event.ts` with its target type and a `.strict()` metadata object, and a valid example to `audit-event.test.ts`.
3. **Run `bun run test`**: `test/architecture/audit-coverage.test.ts` fails when a state-changing use case of an audited feature records nothing.
   :::

:::prompt{title="Paste this into your coding agent"}
```text
Make <use case> record an audit event: add the action to the catalog with its target and
strict metadata, record it after the change, and add the tests the audit-coverage test asks
for. Follow docs/guides/how-to-use-the-audit-log.md.
```
:::

:::gotcha{title="Never rename a recorded action"}
Old rows keep the old name. Name actions `<area>.<past_tense_verb>` and add rather than change metadata fields. Metadata never carries a credential: the tests reject keys that look like one.
:::

## Look up who did something

Platform admins use **Admin › Audit** (filters for actor, action, target, workspace and time) or the agent tool `admin_list_audit_events`.

:::byhand{title="From a terminal"}
```bash
cd apps/web && bunx wrangler d1 execute DB --local --command \
  "SELECT occurred_at, action, outcome, actor_user_id, target_type, target_id, trace_id FROM audit_events ORDER BY occurred_at DESC LIMIT 20"
```

Use `--remote --env <env>` for a deployed environment, then search the logs for the event's `trace_id`.
:::

:::decision{title="Why append-only"}
`recordAuditEvent` is the only insert and the retention purge the only delete; erasure only redacts the subject's IP and email. A record people can edit is not evidence.
:::

## Reference

What is recorded where, metadata rules, retention, options not built, and the OCSF mapping for an export: [Audit log reference](../reference/audit-log.md).
