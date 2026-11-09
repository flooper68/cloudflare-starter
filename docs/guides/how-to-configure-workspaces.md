# How to configure workspaces, sign-up and roles

::reviewed{date="2026-11-09"}

Decide how people are grouped, who may sign up, and what each role may do. Data belongs to workspaces, never to one person: someone reaches it through a membership with a role, and the role's permissions come from one map in the code. What it looks like in the app: [Workspaces](../features/workspaces.md).

::flow[Choose the mode -> Choose who may sign up -> Deploy -> Invite people]{title="Setting up workspaces: choose the mode, choose who may sign up, deploy, invite people"}

## Choose the settings

:::settings
- WORKSPACE_MODE = multi (personal | single | multi) Alone, one shared workspace for the app, or many
- SIGN_UP = open (open | invite) Anyone, or only people let in by an invitation, a domain or the bootstrap admin
- SIGN_UP_DOMAINS = none With invite: email domains that may sign up without an invitation
- BOOTSTRAP_ADMIN_EMAIL = none May always sign up; owns the app's workspace in single mode and becomes a platform admin
  :::

Deployed environments have no default: the app refuses to start, naming the setting, until you choose.

:::prompt{title="Paste this into your coding agent"}
```text
Use the setup-auth skill to choose the workspace settings for every environment:
<mode>, <open or invite-only> sign-up, bootstrap admin <my address>. Dry run first,
then write them and run doctor.
```
:::

:::byhand
1. `bun run setup:auth --env all --dry-run` shows what it would write (it also asks for `BILLING`).
2. `bun run setup:auth --env production` asks, checks the answers with the app's own rules and writes `apps/web/wrangler.jsonc`.
3. `bun run doctor`, then deploy.
   :::

:::decision{title="Choose the mode before there is data"}
Changing it on an environment with users is a data migration (merging personal workspaces into one, or splitting one).
:::

:::gotcha{title="Combinations the app refuses"}
`single` without a bootstrap admin; `invite` with neither a bootstrap admin nor allowed domains; a bootstrap admin or allowed domains in single mode with email and password but no email verification.
:::

## Invite people

:::steps
1. **An owner invites** from Members, or with the agent tool `invite_member`: an email and a role.
   ::shot{id="invite" alt="The Invite people dialog"}
2. **The link arrives** by email; it works once, for 7 days.
3. **They accept** at the link, signing in or creating an account first.
   :::

:::gotcha{title="Deployed environments need email to invite"}
The link is a credential and is never logged there, so without email an invitation is refused. Locally the link goes to the dev log.
:::

## Replace the roles

`owner` and `member` are placeholders: set your roles and the actions each may do in `packages/features/src/workspaces/domain/permissions.ts` ([how](../reference/workspaces.md#replace-the-roles)).

## Reference

The modes in full, the active workspace, sign-up rules, invitations, audit, roles defined at runtime and stripping what you do not use: [Workspaces reference](../reference/workspaces.md).
