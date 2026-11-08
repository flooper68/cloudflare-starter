# How to configure workspaces, sign-up and roles

::reviewed{date="2026-11-08"}

Decide how people are grouped, who may sign up, and what each role may do. Data belongs to workspaces, never to one person: someone reaches it through a membership with a role, and the role's permissions come from one map in the code ([tenancy and authorization](../architecture/overview.md#tenancy-and-authorization)). What it looks like in the app: [Workspaces](../features/workspaces.md).

::flow[Choose the mode -> Choose who may sign up -> Deploy -> Invite people]{title="Setting up workspaces: choose the mode, choose who may sign up, deploy, invite people"}

## The settings

Four settings per environment. The first two are required and have no default: a deployed app refuses to start, naming the setting, until you choose.

:::settings
- WORKSPACE_MODE = multi (personal | single | multi) Alone, one shared workspace for the app, or many
- SIGN_UP = open (open | invite) Anyone, or only people let in by an invitation, a domain or the bootstrap admin
- SIGN_UP_DOMAINS = none With invite: email domains that may sign up without an invitation
- BOOTSTRAP_ADMIN_EMAIL = none May always sign up; owns the app's workspace in single mode and becomes a platform admin

:::

The defaults above are local development's (`apps/web/.dev.vars.example`).

:::prompt{title="Paste this into your coding agent"}
```text
Use the setup-auth skill to choose the workspace settings for every environment:
<mode>, <open or invite-only> sign-up, bootstrap admin <my address>. Dry run first,
then write them and run doctor.
```
:::

:::byhand
1. `bun run setup:auth --env all --dry-run` shows what it would write (it also asks for `BILLING`: [plans and billing](how-to-configure-plans-and-billing.md)).
2. `bun run setup:auth --env production` asks, checks the answers with the app's own rules and writes `apps/web/wrangler.jsonc`.
3. `bun run doctor` warns for each environment without a choice. Deploy.

Locally, a value in `apps/web/.dev.vars` overrides `wrangler.jsonc`.
:::

:::gotcha{title="Combinations the app refuses"}
- `single` without `BOOTSTRAP_ADMIN_EMAIL`: the workspace needs an owner.
- `invite` with neither `BOOTSTRAP_ADMIN_EMAIL` nor `SIGN_UP_DOMAINS`: nobody could ever sign up.
- `BOOTSTRAP_ADMIN_EMAIL` with email + password but no `AUTH_REQUIRE_EMAIL_VERIFICATION=true`: it would trust whoever signs up with that address first.
- `SIGN_UP_DOMAINS` in `single` mode without verification (or with email + password on).

:::

## Modes

| Mode       | At sign-up                                                             | Members and invitations | Create and switch | In the app                                |
| ---------- | ---------------------------------------------------------------------- | ----------------------- | ----------------- | ----------------------------------------- |
| `personal` | A personal workspace, owned by the user                                | No                      | No                | No members page, no switcher              |
| `single`   | Membership in the app's one workspace (created by the first sign-up)   | Yes                     | No                | Members page, no switcher                 |
| `multi`    | A personal workspace; more are created, joined by invitation, switched | Yes                     | Yes               | Switcher with "Create workspace", members |

:::decision{title="Choose the mode before there is data"}
Changing it on an environment with users is a data migration (merging personal workspaces into one, or splitting one). Plan it like any other.
:::

In `single` mode the bootstrap admin joins as owner, and with open sign-up or an allowed domain everyone else joins as a member. Someone let in only by an invitation gets an account without a workspace and joins by accepting through the link.

### The active workspace

Every workspace procedure and agent tool takes an optional `workspaceId`. Without it the request acts in the user's default workspace: their only one in `personal` and `single` mode, and in `multi` mode the one they switched to last (`workspace.switch`, tool `switch_workspace`), stored on the membership so the web app and agents agree. The web app passes `workspaceId` explicitly, so two tabs in different workspaces do not interfere. A workspace the user is not a member of answers NOT_FOUND.

## Sign-up

:::steps
1. **Someone signs up**, with any method. The check runs before the account is created (`enforceSignUpPolicy` in `apps/web/src/server/auth.ts`), so Google is covered too.
2. **Refused?** They see "ask for an invitation" (code `SIGN_UP_INVITE_ONLY`). In `single` mode with billing on, a sign-up past the plan's seats is refused with `LIMIT_REACHED`; the bootstrap admin and invitees never are.
3. **Accepted:** the new user gets their workspace (`provisionUser`). If that fails, the account exists and the first workspace request heals it.

:::

:::gotcha{title="With email verification on, refusals look like success"}
Better Auth answers every email + password sign-up with the same "check your email", refused ones included, so nobody can probe which addresses have accounts. A refused sign-up creates and sends nothing.
:::

Nothing grants access to shared data on the strength of an address alone: an invitation is joined only through its link, and in `personal` and `multi` mode an allowed domain only lets someone create an account with their own empty workspace.

## Invitations

:::steps
1. **An owner invites** from Members (or with the agent tool `invite_member`): an email and a role.
   ::shot{id="invite" alt="The Invite people dialog"}
2. **The link arrives** by email: `<APP_URL>/invite/<token>`, valid 7 days, single use. Only the token's SHA-256 hash is stored; a new invitation to the same address replaces the pending one.
3. **They accept** at `/invite/<token>`: accept (signed in as the invited address), sign in or create an account (it brings them back), or ask for a new link.

:::

:::gotcha{title="Deployed environments need email to invite"}
The link is a credential and is never logged there, so without email an invitation is refused (`PRECONDITION_FAILED`, nothing written). Locally, with `APP_ENV=local`, the link goes to the dev log instead.
:::

A workspace always keeps someone who can manage its members: the last owner cannot leave, be removed or be demoted, and transfers ownership first (`workspace.transferOwnership`). The same rule refuses deleting a user who is the last owner of a workspace others still use.

## Audit

Every change to workspaces, memberships and invitations is in the audit log ([how-to-use-the-audit-log.md](./how-to-use-the-audit-log.md)): `workspace.created`, `workspace.updated`, `workspace.logo_updated`, `workspace.logo_removed`, `workspace.member_joined`, `workspace.member_left`, `workspace.member_removed`, `workspace.member_role_changed`, `workspace.ownership_transferred`, `workspace.invitation_created`, `workspace.invitation_accepted`, `workspace.invitation_revoked` and `workspace.deleted`. A new state-changing use case records its own action (`test/architecture/audit-coverage.test.ts`).

## Replace the roles

`owner` and `member` are placeholders. The permission map is `packages/features/src/workspaces/domain/permissions.ts`:

:::steps
1. **Name your roles:** set `ROLES`, and `CREATOR_ROLE` and `DEFAULT_MEMBER_ROLE` to two of them.
2. **Map the actions:** rewrite `ACTIONS`, every action a use case checks, to the roles allowed. At least one role keeps `members.manage`, and `CREATOR_ROLE` has it (the domain test checks both).
3. **Check in use cases:** `requirePermission(actor, "<action>")`, with a domain test in `permissions.test.ts`.
4. **Update the screens:** the role lists in `apps/web/src/components/app/pages/MembersPage.tsx`.

:::

:::gotcha{title="Renaming a role needs a data migration"}
Roles are stored as text on `workspace_members.role`; a role not in `ROLES` gets no permissions.
:::

### Roles defined at runtime

If customers must define their own roles, keep the map as the list of actions and add a `workspace_roles` table (workspace, name, actions) that `can()` reads through the actor; the use cases do not change because they only ask `can(role, action)`. The starter does not ship this.

## Strip what you do not use

| Product                 | Keep                      | Remove (optional)                                                                                                                                                                                                  |
| ----------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Every user works alone  | `WORKSPACE_MODE=personal` | `MembersTable`, `InviteDialog`, `AcceptInvitationCard`, `WorkspaceSwitcher` usage, `pages/invite/[token].astro`, the invitation and member procedures and their agent tools (the parity test lists what to delete) |
| One team, one workspace | `WORKSPACE_MODE=single`   | `workspace.create`, `workspace.switch` and their tools, the switcher's create dialog                                                                                                                               |
| Many teams              | `WORKSPACE_MODE=multi`    | Nothing                                                                                                                                                                                                            |

Keep the `workspaces` tables and `workspace_id` on data tables in every case: they cost little and make a later change of mode a data change, not a rewrite.

Owners manage names and logos, and delete shared workspaces after confirming, in Settings › Workspace (`workspace.manage`, `workspace.delete`); deletion is refused for personal and single-mode workspaces. See [settings](how-to-use-settings.md).
