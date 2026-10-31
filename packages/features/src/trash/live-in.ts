import { and, eq, isNull, type SQL } from "drizzle-orm";

import type { Actor } from "../workspaces";
import type { TrashableTable } from "./define-trashable-entity";

/**
 * The rows of a trashable table that the actor's workspace sees as live: in its
 * workspace and not in the trash. Every read of a trashable table outside the trash uses
 * it (test/architecture/trash.test.ts).
 */
export function liveIn(table: TrashableTable, actor: Actor): SQL {
  return and(
    eq(table.workspaceId, actor.workspaceId),
    isNull(table.deletedAt)
  ) as SQL;
}
