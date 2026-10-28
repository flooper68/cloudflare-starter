import { and, inArray } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { BillingGate, Clock, Ids, RequestContext } from "../kernel";
import { type Actor, requirePermission } from "../workspaces";
import type { TrashableEntity } from "./define-trashable-entity";
import {
  chunked,
  type TrashItemRef,
  type TrashItemsInput,
  trashItemsInputSchema,
} from "./domain";
import { findTrashedItems } from "./find-trashed-items";
import { trashedIn } from "./trashed-in";

/**
 * Brings items back from the actor's workspace's trash. Needs `trash.restore` and each
 * entity's own write permission; every item must be in this trash (all or nothing), and
 * each entity's `checkRestore` must pass. Records `trash.item_restored` per item.
 */
export async function restoreItems(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly billing: BillingGate;
    readonly entities: readonly TrashableEntity[];
  },
  actor: Actor,
  input: TrashItemsInput
): Promise<{ readonly restored: readonly TrashItemRef[] }> {
  requirePermission(actor, "trash.restore");
  const { items } = trashItemsInputSchema.parse(input);
  const groups = await findTrashedItems(deps, actor, { items });
  for (const { entity, rows } of groups) {
    requirePermission(actor, entity.permission);
    await entity.checkRestore(deps, actor, rows);
  }

  const updates = groups.flatMap(({ entity, rows }) =>
    chunked(
      rows.map((row) => row.id),
      50
    ).map((ids) =>
      deps.db
        .update(entity.table)
        .set({ deletedAt: null, deletedBy: null } as never)
        .where(
          and(inArray(entity.table.id, ids), trashedIn(entity.table, actor))
        )
    )
  );
  const [first, ...rest] = updates;
  if (first) await deps.db.batch([first, ...rest]);

  const restored = groups.flatMap(({ entity, rows }) =>
    rows.map((row) => ({ type: entity.type, id: row.id }))
  );
  for (const item of restored) {
    await recordAuditEvent(deps, deps.requestContext, {
      action: "trash.item_restored",
      actor: { kind: "user", userId: actor.userId },
      workspaceId: actor.workspaceId,
      target: item,
      metadata: { entityType: item.type },
    });
  }
  return { restored };
}
