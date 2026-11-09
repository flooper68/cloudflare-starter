# Notes: the feature to copy

::reviewed{date="2026-11-08"}

Notes is a small, real feature wired end to end: screens, an API, agent tools, permissions, limits, the trash and the audit log. Copy its shape for your own product, then delete it.

::video{id="platform" poster="notes" title="App platform in 75 seconds"}

## Where to find it

:::screenshot{shot="notes" alt="Notes: the list of the workspace's notes"}
- **New note**
- Search by title and body

:::

:::screenshot{shot="note-detail" alt="A note with its comment"}
- **Edit** the body
- **Move to trash**: restore it for 30 days
- Comments from anyone in the workspace

:::

## How it works

::flow[Screen -> Typed API -> Use case -> Database]{title="One feature, four layers: the screen calls the typed API, which runs a use case against the database"}

- One use case per action checks the role's permission, the plan's limit and records an audit event.
- Each procedure has an agent tool, so an agent can do what the screen does.
- Deleting moves a note to the trash; billing counts only live notes.

## Turn it on

It is on. To build your own feature on the same pattern:

:::prompt{title="Paste this into your coding agent"}
```text
Add a "Bookmarks" feature modelled on Notes: table, use cases with permissions and audit,
tRPC procedures, MCP tools, a list and detail screen, trash support and tests.
Follow docs/guides/how-to-add-a-feature.md.
```
:::

## Use it

:::tabs
```text title="In the app"
Notes (sidebar)   list, search, create, edit, comment, move to trash
Command palette   type a note's title to jump to it
```
```ts title="API"
const notes = await trpc.notes.list.query({});
await trpc.notes.create.mutate({
  title: "Renew domain",
  body: "Expires on the 30th.",
});
```
```json title="MCP"
{
  "method": "tools/call",
  "params": {
    "name": "create_note",
    "arguments": { "title": "Renew domain", "body": "Expires on the 30th." }
  }
}
```
:::

:::decision{title="Why a placeholder ships at all"}
A working example shows every rule the architecture tests check (audit, privacy, trash, rate limits, agent tools) in one place. Reading it is faster than reading the rules.
:::

## Limits

- Free plan: 50 notes; Pro: unlimited (examples in the catalog).
- Remove it when your feature is in: [removing Notes](../reference/adding-a-feature.md#removing-notes-from-a-project).

## Related

- [Add a feature](../guides/how-to-add-a-feature.md)
- [Command palette](command-palette.md)
- [Privacy and data](privacy.md): the trash
