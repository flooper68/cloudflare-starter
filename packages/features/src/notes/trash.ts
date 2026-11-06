import { and, inArray, isNotNull, lte } from "drizzle-orm";

import { chunked, defineTrashableEntity } from "../trash";
import { NOTE_TRASH_RETENTION_DAYS } from "./domain";
import { notes } from "./notes.schema";

/** D1 binds at most 100 parameters per statement. */
const IDS_PER_STATEMENT = 50;

/**
 * Notes in the trash (docs/guides/how-to-use-trash.md). Restoring needs `notes.write`
 * and room in the plan's `notes` limit (trashed notes do not count toward it). A note owns
 * nothing outside D1; its comments go with it (ON DELETE CASCADE). `purge` is also the
 * erasure path, bypassing the trash.
 */
export const noteTrash = defineTrashableEntity<typeof notes.$inferSelect>({
  type: "note",
  table: notes,
  retentionDays: NOTE_TRASH_RETENTION_DAYS,
  permission: "notes.write",
  summarize: (note) => ({ label: note.title, sizeBytes: null }),
  async checkRestore(deps, actor, rows) {
    await deps.billing.requireLimit(actor.workspaceId, "notes", rows.length);
  },
  async purge(deps, ids, options) {
    const purgedIds: string[] = [];
    for (const chunk of chunked(ids, IDS_PER_STATEMENT)) {
      // Guarded: a note restored meanwhile is not deleted.
      const deleted = await deps.db
        .delete(notes)
        .where(
          options.trashedOnly
            ? and(
                inArray(notes.id, chunk),
                isNotNull(notes.deletedAt),
                options.trashedAtOrBefore
                  ? lte(notes.deletedAt, options.trashedAtOrBefore)
                  : undefined
              )
            : inArray(notes.id, chunk)
        )
        .returning({ id: notes.id });
      if (deleted.length > 0)
        await options.onRowsDeleted?.(deleted.map((row) => row.id));
      purgedIds.push(...deleted.map((row) => row.id));
    }
    return { purgedIds };
  },
});
