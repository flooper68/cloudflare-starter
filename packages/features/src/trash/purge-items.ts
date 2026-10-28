import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { type Actor, requirePermission } from "../workspaces";
import type { TrashableEntity } from "./define-trashable-entity";
import {
  chunked,
  PURGE_CHUNK,
  type TrashItemRef,
  type TrashItemsInput,
  trashItemsInputSchema,
} from "./domain";
import { findTrashedItems } from "./find-trashed-items";

/**
 * Deletes items from the actor's workspace's trash for good (`trash.purge`): every item
 * must be in this trash (all or nothing). Each entity deletes the rows still in the
 * trash, then what they stored (R2 objects); only those are reported and audited. Records `trash.item_purged` (reason `manual`) per item.
 */
export async function purgeItems(
  deps: {
    readonly db: Database;
    readonly bucket: R2Bucket;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly entities: readonly TrashableEntity[];
  },
  actor: Actor,
  input: TrashItemsInput
): Promise<{ readonly purged: readonly TrashItemRef[] }> {
  requirePermission(actor, "trash.purge");
  const { items } = trashItemsInputSchema.parse(input);
  const groups = await findTrashedItems(deps, actor, { items });

  const purged: TrashItemRef[] = [];
  for (const { entity, rows } of groups) {
    // A chunk at a time, audited as soon as it is gone: a failure later leaves every
    // deleted item recorded. Only what purge deleted counts (a concurrent restore wins).
    for (const ids of chunked(
      rows.map((row) => row.id),
      PURGE_CHUNK
    )) {
      const { purgedIds } = await entity.purge(deps, ids, {
        trashedOnly: true,
      });
      await Promise.all(
        purgedIds.map((id) =>
          recordAuditEvent(deps, deps.requestContext, {
            action: "trash.item_purged",
            actor: { kind: "user", userId: actor.userId },
            workspaceId: actor.workspaceId,
            target: { type: entity.type, id },
            metadata: { entityType: entity.type, reason: "manual" },
          })
        )
      );
      purged.push(...purgedIds.map((id) => ({ type: entity.type, id })));
    }
  }
  return { purged };
}
