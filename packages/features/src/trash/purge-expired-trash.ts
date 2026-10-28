import { and, asc, isNotNull, lte } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import { enqueueJob } from "../jobs";
import type { Clock, Ids, RequestContext } from "../kernel";
import type { JobQueue } from "../platform";
import type { TrashableEntity } from "./define-trashable-entity";
import {
  chunked,
  PURGE_CHUNK,
  purgeExpiredTrashJob,
  trashPurgeCutoff,
} from "./domain";

/** Items purged per entity per run, so one run stays short. */
const BATCH = 500;

/**
 * The `trash.purge-expired` job: deletes for good every trashed item, of every workspace,
 * whose entity's retention ran out as of `asOf` (the cron run's time). Up to 500 items
 * per entity per run, oldest first; rows first (only those still trashed before the
 * cutoff), then their R2 objects. Records
 * `trash.item_purged` (reason `retention`, the system as actor) per item. While a batch
 * comes back full it enqueues itself again with the same `asOf`, so a backlog drains
 * without one long run; a rerun finds only what is left (idempotent).
 */
export async function purgeExpiredTrash(
  deps: {
    readonly db: Database;
    readonly bucket: R2Bucket;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly jobQueue: JobQueue;
    /** The job delivery's context: audit events and the follow-up job carry its trace. */
    readonly requestContext: RequestContext;
    readonly entities: readonly TrashableEntity[];
  },
  input: { readonly asOf: string }
): Promise<{ readonly purged: number; readonly continued: boolean }> {
  const asOf = new Date(input.asOf);
  let purged = 0;
  let continued = false;
  for (const entity of deps.entities) {
    const t = entity.table;
    const cutoff = trashPurgeCutoff(asOf, entity.retentionDays);
    const rows = await deps.db
      .select({ id: t.id, workspaceId: t.workspaceId })
      .from(t)
      .where(and(isNotNull(t.deletedAt), lte(t.deletedAt, cutoff)))
      .orderBy(asc(t.deletedAt))
      .limit(BATCH);
    const workspaceOf = new Map(
      rows.map((row) => [String(row.id), String(row.workspaceId)])
    );
    for (const ids of chunked([...workspaceOf.keys()], PURGE_CHUNK)) {
      // Guarded by the cutoff too: an item restored (or restored and trashed again)
      // since the select is not deleted, and not audited.
      const { purgedIds } = await entity.purge(deps, ids, {
        trashedOnly: true,
        trashedAtOrBefore: cutoff,
      });
      await Promise.all(
        purgedIds.map((id) =>
          recordAuditEvent(deps, deps.requestContext, {
            action: "trash.item_purged",
            actor: { kind: "system" },
            workspaceId: String(workspaceOf.get(id)),
            target: { type: entity.type, id },
            metadata: { entityType: entity.type, reason: "retention" },
          })
        )
      );
      purged += purgedIds.length;
    }
    if (rows.length === BATCH) continued = true;
  }
  if (continued) {
    await enqueueJob(
      deps,
      purgeExpiredTrashJob,
      { asOf: input.asOf },
      { context: deps.requestContext }
    );
  }
  return { purged, continued };
}
