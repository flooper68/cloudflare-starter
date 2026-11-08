# Export, delete, restore and audit

::reviewed{date="2026-11-08"}

People can take their data with them, delete their account, and get back what they deleted by mistake. Every change is written to an audit log you can search. It is built in, so a data request is a click, not a project.

::video{id="privacy" poster="settings-privacy" title="Privacy & data in 60 seconds"}

## Where to find it

::shot{id="settings-privacy" alt="Settings › Privacy: export your data or delete your account"}

:::screenshot{shot="trash" alt="The Trash, with a deleted note to restore"}
- **Restore** brings it back; after 30 days it is deleted for good

:::

## How it works

::flow[Request export -> Built in the background -> Notification with a link -> Download, 24 hours]{title="Data export: request it, a background job builds the archive, a notification brings the link, which works for 24 hours"}

- Exports are a ZIP of the person's (or, for an owner, the workspace's) data, built by a job and delivered by a signed link that only that person can open.
- Deleting an account runs one erasure pipeline, for self-service and for admins alike.
- Every table declares what it holds and how it is exported or erased; CI fails on a table that does not.

## Turn it on

It is on. Exports are stored in file storage; set an expiry rule on the bucket for old archives:

:::prompt{title="Paste this into your coding agent"}
```text
Run `bun run setup:privacy-storage --env production --dry-run`, explain what it would
change on the bucket, then run it for real if it only adds the export expiry rule.
```
:::

:::settings
- STORAGE_RECONCILE = off (off | report | delete) Daily check for orphaned files: off, report them, or delete them

:::

## Use it

:::tabs
```text title="In the app"
Settings › Privacy   export my data, export this workspace (owners), delete my account
Trash (sidebar)      restore, delete for good (owners), empty
Admin › Audit        who did what, when, filtered
```
```ts title="API"
await trpc.privacy.requestExport.mutate(); // personal; { workspaceId } for a workspace
const trash = await trpc.trash.list.query({});
```
```json title="MCP"
{ "method": "tools/call", "params": { "name": "list_trash", "arguments": {} } }
```
:::

:::decision{title="Why erasure has no agent tool"}
Deleting an account for good is a browser-only action behind a fresh sign-in and the second factor. Agents can request exports, never erase.
:::

:::gotcha{title="A restored database brings erased people back"}
After a point-in-time restore, re-apply the erasure ledger ([erasure and retained data](../guides/how-to-handle-data-privacy.md#erasure-and-retained-data)).
:::

## Limits

- One active export per person, three a day; an archive is at most 1 GiB and 10,000 entries.
- Trash keeps files and notes 30 days.
- These are capabilities, not a claim of legal compliance for your app.

## Related

- [Handle a data request](../guides/how-to-handle-data-privacy.md)
- [Use the trash](../guides/how-to-use-trash.md) and [the audit log](../guides/how-to-use-the-audit-log.md)
- [Admin portal](admin.md): data requests
