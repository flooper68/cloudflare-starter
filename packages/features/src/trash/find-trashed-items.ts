import { and, inArray } from "drizzle-orm";

import type { Database } from "../database";
import { type Actor, requirePermission } from "../workspaces";
import type { TrashableEntity, TrashableRow } from "./define-trashable-entity";
import {
  chunked,
  InvalidTrashInputError,
  TrashItemNotFoundError,
  type TrashItemRef,
} from "./domain";
import { trashedIn } from "./trashed-in";

/** Trashed rows of one entity type. */
export interface TrashedGroup {
  readonly entity: TrashableEntity;
  readonly rows: readonly TrashableRow[];
}

/**
 * Loads the named items from the actor's workspace's trash, grouped by entity type, for
 * restore and permanent delete. All or nothing: an unknown type is InvalidTrashInputError,
 * an item that is not in this trash (missing, live, another workspace's) is
 * TrashItemNotFoundError.
 */
export async function findTrashedItems(
  deps: {
    readonly db: Database;
    readonly entities: readonly TrashableEntity[];
  },
  actor: Actor,
  input: { readonly items: readonly TrashItemRef[] }
): Promise<readonly TrashedGroup[]> {
  requirePermission(actor, "trash.read");
  const byType = new Map<string, string[]>();
  for (const item of input.items) {
    byType.set(item.type, [...(byType.get(item.type) ?? []), item.id]);
  }

  const groups: TrashedGroup[] = [];
  for (const [type, ids] of byType) {
    const entity = deps.entities.find((candidate) => candidate.type === type);
    if (!entity) {
      throw new InvalidTrashInputError(`Unknown trash item type: ${type}`);
    }
    const rows: TrashableRow[] = [];
    for (const chunk of chunked(ids, 50)) {
      const found = (await deps.db
        .select()
        .from(entity.table)
        .where(
          and(inArray(entity.table.id, chunk), trashedIn(entity.table, actor))
        )) as unknown as TrashableRow[];
      rows.push(...found);
    }
    const found = new Set(rows.map((row) => row.id));
    const missing = ids.find((id) => !found.has(id));
    if (missing !== undefined) {
      throw new TrashItemNotFoundError({ type, id: missing });
    }
    groups.push({ entity, rows });
  }
  return groups;
}
