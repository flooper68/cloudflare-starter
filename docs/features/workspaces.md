# Workspaces, members and roles

::reviewed{date="2026-11-08"}

People work together in workspaces: invite a teammate by email, give them a role, and every screen, API call and agent follows the same rules. Your data belongs to a workspace, never to one person.

::video{id="workspaces" poster="members" title="Workspaces, billing & admin in 90 seconds"}

## Where to find it

:::screenshot{shot="members" alt="Members of the sample workspace, with a pending invitation"}
- **Invite people**: an email and a role
- A pending invitation holds a seat until it is accepted or revoked

:::

## How it works

::flow[Invite by email -> Link in the inbox -> Accept -> Member with a role]{title="Invitation flow: invite by email, the link arrives, the person accepts and joins with a role"}

- The link works once, for 7 days. Only its hash is stored.
- Roles come from one permission map. The app, the API and agents ask the same question: may this role do this action?
- A workspace always keeps an owner: the last one cannot leave or be removed.

## Turn it on

:::settings
- WORKSPACE_MODE = multi (personal | single | multi) Alone, one shared workspace, or many
- SIGN_UP = open (open | invite) Anyone, or only people you let in
- SIGN_UP_DOMAINS = none Email domains that may join without an invitation
- BOOTSTRAP_ADMIN_EMAIL = none The first admin, who may always sign up

:::

Deployed environments ship with no choice on purpose: the app refuses to start until you pick.

:::prompt{title="Paste this into your coding agent"}
```text
Use the setup-auth skill to choose the workspace mode and sign-up policy for
production: many workspaces, invite-only sign-up, me as the bootstrap admin.
Dry run first.
```
:::

:::byhand
1. `bun run setup:auth --env production --dry-run` shows what it would write.
2. Run it without `--dry-run`, then `bun run doctor`, then deploy.

The modes in full: [Configure workspaces](../guides/how-to-configure-workspaces.md#modes).
:::

## Use it

:::steps
1. **Create a workspace** from the workspace menu (many-workspaces mode).
   ::shot{id="workspace-menu" alt="The workspace switcher, with Create workspace"}
2. **Invite people** from Members. They get an email with a link.
   ::shot{id="invite" alt="The Invite people dialog"}
3. **Name it and add a logo** in Settings › Workspace.

:::

:::tabs
```ts title="API"
await trpc.workspace.invitations.create.mutate({
  email: "grace@example.com",
  role: "member",
});
const members = await trpc.workspace.members.list.query();
```
```json title="MCP"
{
  "method": "tools/call",
  "params": {
    "name": "invite_member",
    "arguments": { "email": "grace@example.com", "role": "member" }
  }
}
```
:::

:::decision{title="Why the mode has no default"}
Changing the mode after people have data is a data migration. Choosing it before the first deploy costs nothing.
:::

:::gotcha{title="Invitations need email when deployed"}
The link is a credential, so a deployed environment without email refuses to create one. Locally the link goes to the dev log.
:::

## Limits

- `owner` and `member` are placeholders: [replace the roles](../guides/how-to-configure-workspaces.md#replace-the-roles) with your product's.
- Seats (members plus pending invitations) count against the plan's limit ([Billing](billing.md)).

## Related

- [Plans and usage limits](billing.md)
- [Admin portal](admin.md): rescue a workspace that lost its owner
- [Sign-in and two-factor](accounts.md)
