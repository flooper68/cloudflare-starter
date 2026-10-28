import { asc } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { type Actor, requirePermission } from "../workspaces";
import type { TrashableEntity } from "./define-trashable-entity";
import { PURGE_CHUNK } from "./domain";
import { trashedIn } from "./trashed-in";

/** Items one request deletes at most, so a huge trash never makes one long request. */
const MAX_PER_REQUEST = 1000;

/**
 * Deletes everything in the actor's workspace's trash for good (`trash.purge`), oldest
 * first, up to 1000 items per call: `remaining` is true when more is left and the caller
 * calls again (the web app and agents do). Records `trash.item_purged` (reason
 * `empty_trash`) per deleted item, right after each round.
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
): Promise<{ readonly purged: number; readonly remaining: boolean }> {
  requirePermission(actor, "trash.purge");
  let purged = 0;
  for (const entity of deps.entities) {
    for (;;) {
      if (purged >= MAX_PER_REQUEST) return { purged, remaining: true };
      const rows = await deps.db
        .select({ id: entity.table.id })
        .from(entity.table)
        .where(trashedIn(entity.table, actor))
        .orderBy(asc(entity.table.deletedAt))
        .limit(PURGE_CHUNK);
      if (rows.length === 0) break;
      const { purgedIds } = await entity.purge(
        deps,
        rows.map((row) => String(row.id)),
        { trashedOnly: true }
      );
      await Promise.all(
        purgedIds.map((id) =>
          recordAuditEvent(deps, deps.requestContext, {
            action: "trash.item_purged",
            actor: { kind: "user", userId: actor.userId },
            workspaceId: actor.workspaceId,
            target: { type: entity.type, id },
            metadata: { entityType: entity.type, reason: "empty_trash" },
          })
        )
      );
      purged += purgedIds.length;
      if (rows.length < PURGE_CHUNK) break;
    }
  }
  return { purged, remaining: false };
}
