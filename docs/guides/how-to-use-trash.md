# How to use the trash

How soft delete works in this starter: what "move to trash" does, how reads stay correct, how restore, permanent delete and the daily retention purge work, and how to make another table trashable. Use when you make a table trashable, read a trashable table, change a retention, debug an item that is missing or came back, or erase data for good (account deletion, GDPR).

## What it does

Deleting a file moves it to its workspace's **trash**: the row stays, with `deleted_at` and `deleted_by` set, and the R2 object stays. From then on:

- the file is gone from every live read: the file list, `/api/files/<id>` (404), `storage.getDownloadUrl`, MCP `list_files`;
- it shows in the trash (`/app/trash`, `trash.list`, MCP `list_trash`) with who deleted it and when it is deleted for good (`purgeAt`);
- any member can restore it (`trash.restore`, MCP `restore_from_trash`); an owner can delete it for good sooner (`trash.deletePermanently`, `trash.empty`);
- after the entity's retention (files: 30 days, `FILE_TRASH_RETENTION_DAYS`) the daily job `trash.purge-expired` deletes the row and the object.

A presigned download URL issued before the file was trashed stays valid until it expires (one hour): R2 checks only its signature. New URLs are refused at once.

| Who    | Move to trash (`files.delete`) | See trash (`trash.read`) | Restore (`trash.restore` + the entity's write permission) | Delete permanently, empty (`trash.purge`) |
| ------ | ------------------------------ | ------------------------ | --------------------------------------------------------- | ----------------------------------------- |
| owner  | yes                            | yes                      | yes                                                       | yes                                       |
| member | yes                            | yes                      | yes                                                       | no                                        |

The roles are placeholders ([how-to-configure-workspaces.md](how-to-configure-workspaces.md#replace-the-roles)); the actions are in `ACTIONS` (`packages/features/src/workspaces/domain/permissions.ts`).

## API and tools

| Procedure                 | MCP tool                        | Input                                      | Result                                                                                                                                      |
| ------------------------- | ------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage.deleteFile`      | `delete_file`                   | `{ fileId }`                               | `{ type, id, deletedAt, purgeAt }`                                                                                                          |
| `trash.list`              | `list_trash`                    | `{ type?, cursor?, limit? }` (limit ≤ 100) | `{ items: [{ type, id, label, sizeBytes, deletedAt, deletedBy: { userId, name } \| null, purgeAt }], nextCursor, can: { restore, purge } }` |
| `trash.restore`           | `restore_from_trash`            | `{ items: [{ type, id }] }` (1 to 100)     | `{ restored }`                                                                                                                              |
| `trash.deletePermanently` | `delete_from_trash_permanently` | `{ items: [{ type, id }] }` (1 to 100)     | `{ purged }`                                                                                                                                |
| `trash.empty`             | `empty_trash`                   | `{}`                                       | `{ purged, remaining }`: up to 1000 items per call; call again while `remaining`                                                            |

All are workspace procedures (optional `workspaceId`). Restore and permanent delete are all or nothing: if one item is not in this workspace's trash (missing, live, another workspace's), nothing happens and the answer is NOT_FOUND naming it. `delete_file` is not marked destructive (it can be undone); the two permanent ones are. Mutations count against the default `mutation.user` rate limit.

**Concurrency.** Purges delete rows first, conditionally (`DELETE … WHERE deleted_at IS NOT NULL RETURNING`), then the objects of the rows they deleted: a restore that lands first wins and keeps its object, and only rows actually deleted are reported and audited. If the R2 delete fails after the rows are gone, the objects stay orphaned (a storage cost, never a row without its bytes). Restore updates with `RETURNING` and reports and audits only the rows it changed; if a purge took one of the items meanwhile, the answer is NOT_FOUND for it (the others are restored). Purges call the supplied audit callback immediately after each guarded row deletion and before R2 cleanup, so an R2 failure still leaves the deleted rows recorded. Restores audit each round after updating.

The trash list orders items by `deletedAt` (newest first), then type and id; the cursor is `<ms>:<type>:<id>` and opaque to clients.

## How it is built

| Piece             | Where                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Columns and index | `deleted_at` (timestamp ms, null while live), `deleted_by` (FK `user`, `ON DELETE SET NULL`), `INDEX (workspace_id, deleted_at) WHERE deleted_at IS NOT NULL`                   |
| Scope helpers     | `liveIn(table, actor)` and `trashedIn(table, actor)` in `packages/features/src/trash/`: workspace filter plus `deleted_at IS NULL` / `IS NOT NULL`                              |
| Contract          | `TrashableEntity` (`trash/define-trashable-entity.ts`): `type`, `table`, `retentionDays`, `permission`, `summarize(row)`, `checkRestore(deps, actor, rows)`, `purge(deps, ids)` |
| Generic use cases | `listTrash`, `restoreItems`, `purgeItems`, `emptyTrash`, `purgeExpiredTrash` (`trash/`)                                                                                         |
| Catalog           | `TRASH_CATALOG` in `packages/features/src/trash-catalog.ts` (today `fileTrash` from `files/trash.ts`); the trash feature never imports the features it holds                    |
| Moving to trash   | the owning feature's use case (`files/trash-file.ts`, `trashFile`), which records `trash.item_trashed`                                                                          |
| Purge job         | cron entry and job `trash.purge-expired` on the daily schedule ([how-to-add-background-jobs.md](how-to-add-background-jobs.md))                                                 |
| Enforcement       | `test/architecture/trash.test.ts`                                                                                                                                               |

**Why columns and not a trash table or views.** A generic trash table holding JSON snapshots would need every restore to re-insert rows that other rows may reference, lose foreign keys and indexes while trashed, and keep two copies of a schema in step. SQL views (`files_live`) would need a view per table that Drizzle does not type as a table, and writes still have to go to the base table, so the filter would live in two places. Columns plus one helper per read keep the row, its foreign keys and its R2 object where they are, and the architecture test catches a read that forgets the filter.

## Reading a trashable table

Every read of a trashable table goes through `liveIn` (live rows) or `trashedIn` (the trash), never a bare workspace filter:

```ts
import { liveIn } from "../trash";

const rows = await deps.db.query.files.findMany({
  where: liveIn(files, actor),
  orderBy: desc(files.createdAt),
});
```

`test/architecture/trash.test.ts` fails when a feature file reads a table of `TRASH_CATALOG` (`db.query.<table>`, `.from(<table>)`, `<table>.workspaceId`) without `liveIn` or `trashedIn`, unless the file is in its `UNSCOPED_READS` list with a reason. Listed today: account erasure (`files/delete-workspace-files.ts`) and the storage metric (`files/measure-workspace-storage.ts`, see [Billing](#billing)).

**Unique columns.** A trashable table that needs a unique value (a slug, a name per workspace) makes it a partial unique index over live rows, so a trashed row does not block a new one: `uniqueIndex("projects_workspace_slug_idx").on(t.workspaceId, t.slug).where(sql\`${t.deletedAt} IS NULL\`)`. Restoring such a row can then collide with a live one: the entity's `checkRestore`throws a`conflict` DomainError for it.

## Billing

Trashed files keep counting toward `storage_bytes` until they are purged: R2 still stores them, and counting them stops a workspace from trashing files to upload more and then restoring them. So restore needs no storage check, and a purge (permanent delete, empty, retention) lowers the usage at once, because the metric is measured on demand (`files.measureWorkspaceStorage`, [how-to-configure-plans-and-billing.md](how-to-configure-plans-and-billing.md)). An entity with a count-based limit (projects per plan) checks it in `checkRestore` with `deps.billing.requireLimit`, as creation does.

## Retention

Each entity sets `retentionDays` (whole days, at least 1); files use `FILE_TRASH_RETENTION_DAYS` (30) in `files/domain/trash-retention.ts`. The daily cron entry `trash.purge-expired` (03:17 UTC) enqueues the job of the same name with `{ asOf }`, the run's scheduled time. The job (`purgeExpiredTrash`) takes, per entity, up to 500 items of any workspace with `deleted_at <= asOf - retentionDays`, oldest first, and deletes them with the entity's `purge` in rounds of 50 (only rows still trashed at or before the cutoff, so an item restored meanwhile survives), recording `trash.item_purged` for each row actually deleted, right after its round, with `reason: retention` and the system as actor. While a batch comes back full it enqueues itself again with the same `asOf`, so a backlog drains in short runs. A retry or rerun finds only what is left. To change a retention, change the entity's constant; items already in the trash follow the new value at the next run (`purgeAt` in the list is computed, not stored).

## Audit

| Action                | Recorded by                                     | Metadata                                                      |
| --------------------- | ----------------------------------------------- | ------------------------------------------------------------- |
| `trash.item_trashed`  | the entity's move-to-trash use case             | `entityType`                                                  |
| `trash.item_restored` | `restoreItems`                                  | `entityType`                                                  |
| `trash.item_purged`   | `purgeItems`, `emptyTrash`, `purgeExpiredTrash` | `entityType`, `reason` (`manual`, `empty_trash`, `retention`) |

The target is the item (`file:<id>`); the target type is the entity's `type`, one of `AUDIT_TRASH_TARGET_TYPES` (`audit/domain/audit-event.ts`). [how-to-use-the-audit-log.md](how-to-use-the-audit-log.md).

## Erasure (account deletion, GDPR)

The trash is for mistakes, not for erasure. When data must be gone now (a deleted account's workspaces, a GDPR erasure request), call the entity's `purge` (`fileTrash.purge(deps, ids, { trashedOnly: false })`, exported from the features package) or `deleteWorkspaceFiles` directly: both delete live and trashed rows and their objects at once, bypassing the trash and its retention. `purge` checks no permission; the caller chooses the ids.

## Making a table trashable

1. Add `deletedAt: integer("deleted_at", { mode: "timestamp_ms" })` and `deletedBy: text("deleted_by").references(() => user.id, { onDelete: "set null" })` to the table, and `index("<table>_workspace_id_deleted_at_idx").on(t.workspaceId, t.deletedAt).where(sql\`${t.deletedAt} IS NOT NULL\`)`. Make unique indexes partial (`WHERE deleted_at IS NULL`). `bun run db:generate` ([how-to-setup-d1.md](how-to-setup-d1.md)).
2. Add the type to `AUDIT_TRASH_TARGET_TYPES` and `AUDIT_TARGET_TYPES` in `audit/domain/audit-event.ts`.
3. In the feature, declare the entity in `<feature>/trash.ts` with `defineTrashableEntity({ type, table, retentionDays, permission, summarize, checkRestore, purge })`; `purge(deps, ids, { trashedOnly, trashedAtOrBefore? })` deletes the rows first with a conditional `DELETE … RETURNING` (only rows still trashed, and trashed at or before the cutoff when given), calls `options.onRowsDeleted` to audit those ids before external cleanup, then deletes whatever the rows owned outside D1, in statements of at most 50 ids (D1 binds 100 parameters), and returns the ids it deleted.
4. Write the move-to-trash use case (`requirePermission`, set `deletedAt`/`deletedBy` where `liveIn(...)`, record `trash.item_trashed`), its procedure and MCP tool (not destructive).
5. Change every read of the table to `liveIn` or `trashedIn`.
6. Add the entity to `TRASH_CATALOG`. If its `purge` reads the table (it should delete with `RETURNING` instead), list `trash.ts` in `UNSCOPED_READS` of `test/architecture/trash.test.ts` with a reason.
7. Tests: the entity (`summarize`, `purge` removes what it owns, idempotent), the move-to-trash use case (gone from live reads, audit), and the API test of its procedure. The generic trash use cases already cover listing, restore and purge.

## Optional storage reconciliation

Rows are deleted conditionally before R2 objects so a concurrent restore cannot lose its bytes. A failed R2 delete can leave an object without a row. `STORAGE_RECONCILE` is required, explicitly `off`, `report`, or `delete` in each environment; the shipped value is `off`. Configure it with `bun run setup:storage --env all --dry-run`, then run the same command without `--dry-run` after approval. This writes source configuration only; deploy separately. Set the local value in `.dev.vars` (see the example); `bun run doctor` validates it.

The daily `storage.reconcile` cron at 03:17 UTC does nothing in `off`, queues a report in `report`, and queues cleanup in `delete`. `/admin/settings` has **Run storage report** even when automatic maintenance is off. The separate **Delete orphaned objects** action appears only in `delete` mode and requires recent sign-in plus confirmation. The API mirrors this as `admin.storage.status`, `admin.storage.reconcile`, and `admin.storage.deleteOrphans`; MCP names are `admin_storage_status`, `admin_reconcile_storage`, and `admin_delete_storage_orphans` (destructive). A report is always the default; a queued report never becomes destructive after a setting change. Disabling automatic maintenance stops its queued pages; changing to report downgrades queued deletion.

Each queue delivery lists at most 100 objects under `workspaces/` or `users/`, follows R2's opaque cursor even on a short page, then enqueues the next page. The run's original time fixes a 24-hour grace cutoff: objects at or newer than the cutoff are skipped. Only keys whose shape is owned by a registered `StorageReferenceSource` are examined; unknown paths (including exports) are always preserved. The composition root `storage-reference-catalog.ts` registers the owning feature's batch lookups. File rows protect live files, trash, and presigned uploads that have not completed. Account/avatar and workspace/logo owners must register their reference lookups before those key shapes are eligible. Every new upload uses a new immutable key; do not repoint a row to an old key without updating this safety contract.

Any failed reference lookup aborts the page before deletion. A successful page logs `storage.reconciliation_page` and audits `storage.reconciliation_page`, with scanned/orphaned/deleted counts and at most five sample keys. Admin starts also audit `storage.reconciliation_requested`. Metrics `app.storage.orphaned` and `app.storage.deleted` count objects with only mode as an attribute. Search audit/logs by the returned run id; counts describe page attempts, not an exactly-once global total (a queue retry can repeat report counts). Repeated deletion is safe. Cloudflare's [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/) defines list cursors and the batch delete operation used here.
