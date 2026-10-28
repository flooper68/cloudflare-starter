import { asc } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { type Actor, requirePermission } from "../workspaces";
import type { TrashableEntity } from "./define-trashable-entity";
import { trashedIn } from "./trashed-in";

/** Rows purged per round, so one statement never holds a long write on D1. */
const BATCH = 500;

/**
 * Deletes everything in the actor's workspace's trash for good (`trash.purge`), in rounds
 * of 500 per entity. Records `trash.item_purged` (reason `empty_trash`) per item.
 */
export async function emptyTrash(
  deps: {
    readonly db: Database;
    readonly bucket: R2Bucket;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly entities: readonly TrashableEntity[];
  },
  actor: Actor
): Promise<{ readonly purged: number }> {
  requirePermission(actor, "trash.purge");
  let purged = 0;
  for (const entity of deps.entities) {
    for (;;) {
      const rows = await deps.db
        .select({ id: entity.table.id })
        .from(entity.table)
        .where(trashedIn(entity.table, actor))
        .orderBy(asc(entity.table.deletedAt))
        .limit(BATCH);
      if (rows.length === 0) break;
      const ids = rows.map((row) => String(row.id));
      await entity.purge(deps, ids);
      for (const id of ids) {
        await recordAuditEvent(deps, deps.requestContext, {
          action: "trash.item_purged",
          actor: { kind: "user", userId: actor.userId },
          workspaceId: actor.workspaceId,
          target: { type: entity.type, id },
          metadata: { entityType: entity.type, reason: "empty_trash" },
        });
      }
      purged += ids.length;
      if (rows.length < BATCH) break;
    }
  }
  return { purged };
}
