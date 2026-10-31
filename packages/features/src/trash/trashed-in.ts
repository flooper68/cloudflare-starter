import { and, eq, isNotNull, type SQL } from "drizzle-orm";

import type { Actor } from "../workspaces";
import type { TrashableTable } from "./define-trashable-entity";

/** The rows of a trashable table in the actor's workspace's trash. */
export function trashedIn(table: TrashableTable, actor: Actor): SQL {
  return and(
    eq(table.workspaceId, actor.workspaceId),
    isNotNull(table.deletedAt)
  ) as SQL;
}
