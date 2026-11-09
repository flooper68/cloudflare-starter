# How to use the admin portal

::reviewed{date="2026-11-09"}

The admin portal lets platform admins run the app: find and inspect users, suspend and reinstate them, sign them out, reset their passwords, change their role, impersonate them, rescue and delete workspaces, change feature flags, and read the audit log, at `/admin` and through the `admin_*` agent tools. Use this guide to turn it on, make someone an admin, or add an admin action. What admins see: [The admin portal](../features/admin.md).

::flow[Admin signs in -> Portal or agent -> Fresh sign-in for destructive actions -> Audit entry]{title="Admin flow: an admin acts from the portal or an agent; destructive actions need a fresh sign-in; every action is audited"}

## Turn it on and make an admin

:::settings
- ADMIN_PORTAL = on (on | off) The portal at /admin and the admin tools for agents
  :::

:::prompt{title="Paste this into your coding agent"}
```text
Make <address> a platform admin on production: run `bun run setup:admin --email <address>
--remote --env production --dry-run`, show me the SQL, then run it for real.
```
:::

:::byhand
- **The first admin of an environment:** set `BOOTSTRAP_ADMIN_EMAIL` with `bun run setup:auth`; that account becomes an admin once its address is verified.
- **Anyone later:** `bun run setup:admin --email <address>` (local database; `--remote --env <env>` for a deployed one). The person signs in again to see the portal.
  :::

## Rules every action follows

- Everyone who is not an active admin gets "not found": the portal does not reveal that it exists.
- An admin never acts on their own account; the last active admin cannot be demoted, suspended or deleted.
- Destructive actions need a sign-in from the last 15 minutes and, for an admin with two-factor, a fresh code.
- Every action is audited with the admin as the actor.

:::gotcha{title="Every admin locked out?"}
`bun run setup:admin --email <address>` restores one: promoting also lifts a suspension.
:::

## Add an admin action

An `adminProcedure` (or `adminDestructiveProcedure`) in `apps/web/src/server/trpc/admin-router.ts` calling a use case in `packages/features/src/admin/`, an `admin_*` tool in `tools.ts`, a control on the portal page, and an audit action. Impersonation, account erasure and second-factor reset stay browser-only.

## Reference

What an admin can do (every action, its procedure and rules), recent sign-in, impersonation, how it is built, the portal's pages, adding a page or an action, and what is not built: [Admin portal reference](../reference/admin-portal.md).
