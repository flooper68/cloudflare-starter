import { inArray } from "drizzle-orm";

import { chunked, defineTrashableEntity } from "../trash";
import { FILE_TRASH_RETENTION_DAYS } from "./domain";
import { files } from "./files.schema";

/** R2 deletes at most this many keys per call; D1 binds at most 100 parameters. */
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
  async purge(deps, ids) {
    let purged = 0;
    for (const chunk of chunked(ids, IDS_PER_STATEMENT)) {
      const rows = await deps.db
        .select({ r2Key: files.r2Key })
        .from(files)
        .where(inArray(files.id, chunk));
      // Objects first, then rows: a failure leaves rows to retry, not orphaned objects.
      if (rows.length > 0) {
        await deps.bucket.delete(rows.map((row) => row.r2Key));
      }
      const deleted = await deps.db
        .delete(files)
        .where(inArray(files.id, chunk))
        .run();
      purged += deleted.meta.changes ?? 0;
    }
    return { purged };
  },
});
