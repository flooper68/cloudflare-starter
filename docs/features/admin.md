# The admin portal

::reviewed{date="2026-11-08"}

Run your app without opening the database: find a user, suspend or sign them out, see what they see, rescue a workspace that lost its owner, flip a feature flag and read the audit log. From the browser or from an agent.

::video{id="workspaces" poster="admin-overview" title="Workspaces, billing & admin in 90 seconds"}

## Where to find it

::shot{id="admin-overview" alt="The admin overview: counts, health and the database"}

::shot{id="admin-users" alt="The admin portal's user list"}

## How it works

::flow[Admin signs in -> Portal or agent -> Fresh sign-in for destructive actions -> Audit entry]{title="Admin flow: an admin acts from the portal or an agent; destructive actions need a fresh sign-in; every action is audited"}

- Only platform admins see it; everyone else gets "not found", so the portal does not reveal it exists.
- Destructive actions need a sign-in from the last 15 minutes and, when enrolled, a fresh second factor.
- Every action is audited with the admin as the actor.

## Turn it on

:::settings
- ADMIN_PORTAL = on (on | off) The portal at /admin and the admin tools for agents

:::

:::prompt{title="Paste this into your coding agent"}
```text
Make me a platform admin on production: run `bun run setup:admin --email <my address>
--remote --env production --dry-run`, show me the SQL, then run it for real.
```
:::

:::byhand
- The first admin of a new environment: set `BOOTSTRAP_ADMIN_EMAIL` with `bun run setup:auth`; that account becomes an admin once its address is verified.
- Anyone later: `bun run setup:admin --email <address>` (local database; `--remote --env <env>` for a deployed one).

:::

## Use it

:::tabs
```text title="In the app"
Admin › Overview       users, sign-ups, workspaces, plans, health
Admin › Analytics      the product funnel, sources, features tried
Admin › Users          search, suspend, sign out everywhere, reset password, impersonate
Admin › Workspaces     billing panel, assign an owner, delete
Admin › Flags, Audit, Data requests, Settings (read-only)
```
```ts title="API"
const overview = await trpc.admin.overview.get.query();
```
```json title="MCP"
{
  "method": "tools/call",
  "params": { "name": "admin_get_overview", "arguments": {} }
}
```
:::

::shot{id="admin-flags" alt="Feature flags in the admin portal"}

:::decision{title="Why impersonation stays in the browser"}
It creates a browser session with a banner and an hour's limit. An agent has no browser session to put the banner on, so there is no tool.
:::

:::gotcha{title="The last admin is protected"}
The last active admin cannot be demoted, suspended or deleted. If every admin ends up locked out, `bun run setup:admin` restores one.
:::

## Limits

- An admin never acts on their own account, and admins cannot be impersonated.
- Settings are read-only here: changing them is a deploy.

## Related

- [Use the admin portal](../guides/how-to-use-admin-portal.md)
- [Feature flags](../guides/how-to-use-feature-flags.md)
- [Plans and usage limits](billing.md)
