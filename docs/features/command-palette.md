# Command palette

::reviewed{date="2026-11-08"}

Press ⌘K (Ctrl+K elsewhere) and jump anywhere: any page, any note, another workspace, or an action like inviting a member. Your own features add their search with one entry.

::video{id="platform" poster="command-palette" title="App platform in 75 seconds"}

## Where to find it

:::screenshot{shot="command-palette" alt="The command palette, searching for settings"}
- Type to filter pages, records and actions
- Enter opens the highlighted result

:::

## How it works

::flow[⌘K -> Type -> Pages, notes, workspaces, actions -> Enter]{title="Command palette: press the shortcut, type, pick a page, a note, a workspace or an action, press Enter"}

- The pages come from the same list as the sidebar, filtered by your role, mode and plan, so the palette never offers what you cannot open.
- Each feature that has records adds a search provider; Notes is the example.
- Typing is debounced and stale searches are cancelled.

## Turn it on

It is on. To make your feature searchable:

:::prompt{title="Paste this into your coding agent"}
```text
Make Bookmarks searchable from the command palette like Notes: a search use case with
a permission check, a notes.search-style procedure and MCP tool, and an entry in
paletteSearchProviders, with tests. Follow docs/guides/how-to-add-a-feature.md.
```
:::

## Use it

:::tabs
```text title="In the app"
⌘K or Ctrl+K, or Search in the top bar (full screen on phones)
Groups: Navigate · Notes · Workspaces · Actions
```
```ts title="Add a search"
// A sketch: copy the Notes entry in
// apps/web/src/components/app/command-palette/search-providers.ts
{ id: "bookmarks", heading: "Bookmarks", kind: "bookmark", minQueryLength: 2,
  visible: (ctx) => clientCan(ctx, "bookmarks.read"),
  search: (query, { workspaceId, signal }) => searchBookmarks(query, workspaceId, signal) }
```
```json title="MCP"
{
  "method": "tools/call",
  "params": { "name": "search_notes", "arguments": { "query": "launch" } }
}
```
:::

:::decision{title="Why hiding an entry is only a convenience"}
The palette leaves out what your role cannot do, but the server still checks every action. A hidden entry is never the security boundary.
:::

## Limits

- A search scans the workspace's rows; fine at placeholder size. Large workspaces need a full-text index.
- Analytics records which kind of item was picked, never the query.

## Related

- [Navigation and the command palette](../reference/adding-a-feature.md#navigation-and-the-command-palette)
- [Notes](notes.md)
