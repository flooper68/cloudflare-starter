# How to use the trash

::reviewed{date="2026-11-09"}

Deleting a note or a file moves it to its workspace's trash for 30 days: anyone in the workspace can restore it, owners can delete it for good sooner, and a daily job purges what expired. Use this guide to make your own table trashable, read one correctly, or turn on the clean-up of orphaned files. What people see: [Export, delete, restore and audit](../features/privacy.md).

::flow[Move to trash -> Hidden from live reads -> Restore, or 30 days pass -> Purged for good]{title="Trash flow: an item moved to the trash disappears from live reads, can be restored, and is purged after its retention"}

:::screenshot{shot="trash" alt="The Trash, with a deleted note to restore"}
- **Restore** puts it back where it was, for any member
  :::

## Make a table trashable

:::steps
1. **Add `deleted_at` and `deleted_by`** to the table and implement the trashable contract for it.
2. **Read live rows only**: every live read goes through `liveIn`, every trash read through `trashedIn`.
3. **Register it** with the trash feature and the purge job; the architecture tests list what is missing.
   :::

:::prompt{title="Paste this into your coding agent"}
```text
Make the <table> table trashable like files and notes: follow
docs/reference/trash.md#making-a-table-trashable, keep every live read on liveIn, register
it with the trash feature and the purge job, and add the tests the architecture tests ask for.
```
:::

:::gotcha{title="A signed download link outlives the trash"}
A presigned URL issued before the file was trashed works until it expires (one hour): storage checks only its signature. New links are refused at once.
:::

## Clean up orphaned files

:::settings
- STORAGE_RECONCILE = off (off | report | delete) The daily check for stored objects no row points at
  :::

Start with `report`; admins see the result and can run it on demand. `delete` removes only what a report found, after a confirmation.

:::decision{title="Why a trash instead of a confirmation dialog"}
People delete by mistake. Thirty days to undo is kinder than an "are you sure", and billing counts trashed files until they are purged, so nothing is lost by keeping them.
:::

## Reference

What it does, the API and tools, how it is built, reading a trashable table, billing, retention, audit, erasure and storage reconciliation: [Trash reference](../reference/trash.md).
