# How To Configure Workspaces, Sign-Up And Roles

The app's data belongs to workspaces, never to a single user: a user reaches data through a membership with a role, and the role's permissions come from one map in the code. This guide covers choosing the workspace mode, who may sign up, invitations, replacing the placeholder roles, and removing what a product does not need. The rules behind it are in [architecture/overview.md#tenancy-and-authorization](../architecture/overview.md#tenancy-and-authorization). Use when you start a project and decide how users are grouped, change who may sign up, add roles or actions, or strip the workspace UI.

## The settings

Four vars, set per environment in `apps/web/wrangler.jsonc` (`vars`, top level and each `env.*`). `WORKSPACE_MODE` and `SIGN_UP` are required and have no defaults, and the starter ships no choice: `wrangler.jsonc` has none of the four, so a deployed Worker refuses to start (the error names the setting) until you have chosen. Local development and the tests get explicit values from `apps/web/.dev.vars.example` (multi mode, open sign-up) and `apps/web/vitest.config.ts`. Set them per environment with the script, which checks the answers with the same rules as the app (it also asks for `BILLING`, required as well: [how-to-configure-plans-and-billing.md](how-to-configure-plans-and-billing.md)):

```bash
bun run setup:auth --env all --dry-run    # shows what it would write
bun run setup:auth --env production       # asks, then writes wrangler.jsonc
```

Run it for every environment before its first deploy, then deploy. `bun run doctor` warns for each environment that has no choice yet. Locally, a value in `apps/web/.dev.vars` overrides `wrangler.jsonc`.

| Var                     | Values                        | Effect                                                                                                                |
| ----------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `WORKSPACE_MODE`        | `personal`, `single`, `multi` | How users are grouped (below).                                                                                        |
| `SIGN_UP`               | `open`, `invite`              | `open`: anyone may create an account. `invite`: only the people the next two vars and pending invitations let in.     |
| `SIGN_UP_DOMAINS`       | `acme.com,acme.org` or blank  | With `invite`, email domains whose people may sign up without an invitation (whole domain match, case-insensitive).   |
| `BOOTSTRAP_ADMIN_EMAIL` | an email or blank             | A standing invitation: this address may always sign up. In `single` mode it becomes the owner of the app's workspace. |

Startup refuses `WORKSPACE_MODE=single` without `BOOTSTRAP_ADMIN_EMAIL` (the workspace needs an owner) and `SIGN_UP=invite` with neither `BOOTSTRAP_ADMIN_EMAIL` nor `SIGN_UP_DOMAINS` (nobody could ever sign up). `bun run doctor` runs the same checks per environment.

`BOOTSTRAP_ADMIN_EMAIL` also becomes a platform admin (the admin portal, [how-to-use-admin-portal.md](./how-to-use-admin-portal.md)) once its address is verified. It would trust whoever signs up with that address first, so the app refuses to start with it while email + password sign-up is on without `AUTH_REQUIRE_EMAIL_VERIFICATION=true` (Google sign-in verifies the address; with `AUTH_EMAIL_PASSWORD=false` no verification is needed). `setup:auth` and `doctor` report the same error. Single mode needs a bootstrap admin, so single mode with email + password always runs with verification on, and verification needs email ([how-to-setup-email.md](./how-to-setup-email.md)).

With verification on, Better Auth answers every email + password sign-up with the same "check your email" response, refused ones included (so nobody can probe which addresses have accounts). A refused sign-up then creates nothing and sends nothing, but the person sees no invite-only message; refused Google sign-ups still land on `/sign-in?error=SIGN_UP_INVITE_ONLY`.

Email + password sign-up does not prove the address unless `AUTH_REQUIRE_EMAIL_VERIFICATION=true`. So nothing here grants access to shared data on the strength of an address alone: an invitation is joined only through its link (the token proves the mail arrived), and the app refuses to start with `SIGN_UP_DOMAINS` in `single` mode (where signing up on the domain joins the app's workspace) unless verification is on or email + password is off. In `personal` and `multi` mode an allowed domain or a pending invitation only lets someone create an account with their own empty workspace.

## Modes

| Mode       | At sign-up                                                                | Members and invitations | Create and switch workspaces | UI                                        |
| ---------- | ------------------------------------------------------------------------- | ----------------------- | ---------------------------- | ----------------------------------------- |
| `personal` | A personal workspace, owned by the user                                   | No (FORBIDDEN)          | No                           | No member page, no switcher               |
| `single`   | Membership in the app's one workspace (created by the first sign-up)      | Yes                     | No                           | Members page, no switcher                 |
| `multi`    | A personal workspace; more are created, joined by invitation and switched | Yes                     | Yes                          | Switcher with "Create workspace", members |

In `single` mode the bootstrap admin joins as owner, and with `SIGN_UP=open` or an allowed domain everyone else joins as a member. Someone let in only by an invitation gets an account without a workspace and joins, with the invitation's role, by accepting through the link (signing up from the link brings them back to it). In `multi` mode an invitation is likewise accepted through its link only, after signing in as the invited address.

Choose the mode before there is data. Changing it on an environment with users is a data migration (merging personal workspaces into one, or splitting one): plan it like any other.

### The active workspace

Every workspace procedure and MCP tool takes an optional `workspaceId`. Without it the request acts in the user's default workspace: their only one in `personal` and `single` mode, and in `multi` mode the one they switched to last (`workspace.switch`, MCP `switch_workspace`), which is stored on the membership (`last_active_at`) so the web app and MCP clients agree. The web app reads the default once and passes `workspaceId` explicitly with each call, so two tabs in different workspaces do not interfere. A `workspaceId` the user is not a member of answers NOT_FOUND.

## Sign-up

The check runs in Better Auth's `databaseHooks.user.create.before` (`enforceSignUpPolicy` in `apps/web/src/server/auth.ts`, calling the `checkSignUpAllowed` use case), so it covers every method, Google included. A refused email + password sign-up answers 403 with code `SIGN_UP_INVITE_ONLY`; a refused Google sign-up comes back to `/sign-in?error=SIGN_UP_INVITE_ONLY`, and both show a message that says to ask for an invitation. In `single` mode, with billing on, a sign-up that would join the app's workspace on its own also takes a seat: past the plan's `seats` limit it is refused with code `LIMIT_REACHED` and a "no free seats" message (the bootstrap admin and invitees are never refused; [how-to-configure-plans-and-billing.md](how-to-configure-plans-and-billing.md)). With email verification on, Better Auth answers a refused email sign-up like an accepted one (no account is created). `user.create.after` gives the new user their workspace (`provisionUser`).

Provisioning at sign-up (`user.create.after`) fails open: if it fails, the error is reported and the account exists without a workspace. The first workspace request heals it: in `personal` and `multi` mode `resolveActor` provisions the personal workspace then (the same idempotent use case, audited as `workspace.created`; its id is `personal-<userId>`). In `single` mode the user gets FORBIDDEN with code `NOT_A_WORKSPACE_MEMBER` (`data.appCode` in tRPC errors) and joins through an invitation link.

## Invitations

Owners invite from `/app/members` or with the MCP tool `invite_member`: an email and a role. The link (`<APP_URL>/invite/<token>`) carries a random token; only its SHA-256 hash is stored, and it works for 7 days. A new invitation to the same address replaces the pending one; owners can revoke invitations. The link is mailed through the email service ([how-to-setup-email.md](./how-to-setup-email.md)); without `EMAIL_FROM` it goes to the dev log instead (event `auth.mail_not_sent`, attribute `app.auth.link`) only with `APP_ENV=local`, like password-reset links ([how-to-setup-logging.md](./how-to-setup-logging.md)). A deployed environment without email refuses to create the invitation (`PRECONDITION_FAILED`, nothing written), because the link is a credential and is never logged there: turn email on wherever people invite. Logs of workspace procedures carry the workspace as `app.workspace.id`; `/invite/<token>` paths are redacted in request logs.

`/invite/<token>` shows the workspace and who invited you, then one next step: accept (signed in as the invited address), sign in or create an account (it brings you back), sign out (signed in as someone else), or ask for a new link (expired, revoked or used). Accepting uses the invitation up in the same batch that adds the membership, and only while it is unused, so a link works once.

A workspace always keeps someone who can manage its members: the last owner cannot leave, be removed or be demoted, and transfers ownership first (`workspace.transferOwnership`). The same rule refuses deleting a user who is the last owner of a workspace others still use; their personal workspace, and shared ones nobody else uses, are deleted with their files. The check runs in `user.deleteUser.beforeDelete` (before Better Auth deletes anything, once a project enables its deletion endpoint) and again in `user.delete.before`; a deletion refused only at the second point has already signed the user out, because Better Auth removes sessions and accounts first on that path.

## Audit

Every change to workspaces, memberships and invitations is recorded in the audit log ([how-to-use-the-audit-log.md](./how-to-use-the-audit-log.md)): `workspace.created`, `workspace.member_joined`, `workspace.member_left`, `workspace.member_removed`, `workspace.member_role_changed`, `workspace.ownership_transferred`, `workspace.invitation_created`, `workspace.invitation_accepted`, `workspace.invitation_revoked` and `workspace.deleted`. A new state-changing use case in the feature records its own action (`test/architecture/audit-coverage.test.ts`).

## Replace the roles

`owner` and `member` are placeholders. The permission map is `packages/features/src/workspaces/domain/permissions.ts`:

1. Set `ROLES` to the product's roles, and `CREATOR_ROLE` and `DEFAULT_MEMBER_ROLE` to two of them.
2. Rewrite `ACTIONS`: every action a use case checks, mapped to the roles allowed to do it. At least one role must keep `members.manage`, and `CREATOR_ROLE` must have it (the domain test checks both).
3. A new use case checks its action with `requirePermission(actor, "<action>")`; add the action to `ACTIONS` with a domain test in `permissions.test.ts`.
4. Update the role lists the UI shows (`ROLES` in `apps/web/src/components/app/pages/MembersPage.tsx`).

Roles are stored as text on `workspace_members.role`, so renaming one needs a data migration for existing rows (a role not in `ROLES` gets no permissions).

### Roles defined at runtime

If customers must define their own roles, keep the map as the list of actions and add a `workspace_roles` table (workspace, name, actions) that `can()` reads through the actor; the use cases do not change because they only ask `can(role, action)`. The starter does not ship this.

## Strip what you do not use

| Product                 | Keep                      | Remove                                                                                                                                                                                                                     |
| ----------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every user works alone  | `WORKSPACE_MODE=personal` | Optional: `MembersTable`, `InviteDialog`, `AcceptInvitationCard`, `WorkspaceSwitcher` usage, `pages/invite/[token].astro`, the invitation and member procedures and their MCP tools (the parity test lists what to delete) |
| One team, one workspace | `WORKSPACE_MODE=single`   | Optional: `workspace.create`, `workspace.switch` and their tools, the switcher's create dialog                                                                                                                             |
| Many teams              | `WORKSPACE_MODE=multi`    | Nothing                                                                                                                                                                                                                    |

Keep the `workspaces` tables and `workspace_id` on data tables in every case: they cost little and make a later change of mode a data change, not a rewrite.

Owners manage names/logos and delete confirmed shared workspaces from Settings → Workspace. `workspace.manage` and `workspace.delete` are explicit permission actions; deletion is refused for personal and single-mode workspaces. See [settings](how-to-use-settings.md).
