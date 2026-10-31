import { and, inArray, isNotNull, lte } from "drizzle-orm";

import { chunked, defineTrashableEntity } from "../trash";
import { FILE_TRASH_RETENTION_DAYS } from "./domain";
import { files } from "./files.schema";

/** R2 deletes at most 1000 keys per call; D1 binds at most 100 parameters. */
const IDS_PER_STATEMENT = 50;

/**
 * Files in the trash (docs/guides/how-to-use-trash.md). Restoring needs `files.write`; no
 * storage check, since a trashed file still counts toward `storage_bytes`. `purge` is
 * also the GDPR path: account erasure deletes a workspace's files through it (or
 * deleteWorkspaceFiles), bypassing the trash.
 */
export const fileTrash = defineTrashableEntity<typeof files.$inferSelect>({
  type: "file",
  table: files,
  retentionDays: FILE_TRASH_RETENTION_DAYS,
  permission: "files.write",
  summarize: (file) => ({ label: file.filename, sizeBytes: file.sizeBytes }),
  checkRestore: async () => {},
  async purge(deps, ids, options) {
    const purgedIds: string[] = [];
    for (const chunk of chunked(ids, IDS_PER_STATEMENT)) {
      // Rows first, guarded and returning their keys, then the objects: a file restored
      // meanwhile is not deleted (and keeps its object); a failed R2 delete leaves an
      // orphaned object (a storage cost), never a row without its bytes.
      const deleted = await deps.db
        .delete(files)
        .where(
          options.trashedOnly
            ? and(
                inArray(files.id, chunk),
                isNotNull(files.deletedAt),
                options.trashedAtOrBefore
                  ? lte(files.deletedAt, options.trashedAtOrBefore)
                  : undefined
              )
            : inArray(files.id, chunk)
        )
        .returning({ id: files.id, r2Key: files.r2Key });
      if (deleted.length > 0) {
        await options.onRowsDeleted?.(deleted.map((row) => row.id));
        await deps.bucket.delete(deleted.map((row) => row.r2Key));
      }
      purgedIds.push(...deleted.map((row) => row.id));
    }
    return { purgedIds };
  },
});
