import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { type Actor, requirePermission } from "../workspaces";
import type { TrashableEntity } from "./define-trashable-entity";
import {
  type TrashItemRef,
  type TrashItemsInput,
  trashItemsInputSchema,
} from "./domain";
import { findTrashedItems } from "./find-trashed-items";

/**
 * Deletes items from the actor's workspace's trash for good (`trash.purge`): every item
 * must be in this trash (all or nothing). Each entity removes what it stores (R2 objects
 * first, then rows). Records `trash.item_purged` (reason `manual`) per item.
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
    await entity.purge(
      deps,
      rows.map((row) => row.id)
    );
    for (const row of rows) {
      purged.push({ type: entity.type, id: row.id });
      await recordAuditEvent(deps, deps.requestContext, {
        action: "trash.item_purged",
        actor: { kind: "user", userId: actor.userId },
        workspaceId: actor.workspaceId,
        target: { type: entity.type, id: row.id },
        metadata: { entityType: entity.type, reason: "manual" },
      });
    }
  }
  return { purged };
}
