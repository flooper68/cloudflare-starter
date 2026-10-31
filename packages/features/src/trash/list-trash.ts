import { and, asc, desc, eq, gt, inArray, lt, or, type SQL } from "drizzle-orm";

import { user } from "../accounts";
import type { Database } from "../database";
import { type Actor, can, requirePermission } from "../workspaces";
import type { TrashableEntity, TrashableRow } from "./define-trashable-entity";
import {
  chunked,
  compareTrashPositions,
  decodeTrashCursor,
  encodeTrashCursor,
  InvalidTrashInputError,
  TRASH_PAGE_SIZE_DEFAULT,
  type TrashListInput,
  type TrashPosition,
  trashListInputSchema,
  trashPageStart,
  trashPurgeAt,
} from "./domain";
import { trashedIn } from "./trashed-in";

export interface TrashItem {
  readonly type: string;
  readonly id: string;
  readonly label: string;
  readonly sizeBytes: number | null;
  readonly deletedAt: string;
  /** Who moved it to the trash; null once their account is gone. */
  readonly deletedBy: { readonly userId: string; readonly name: string } | null;
  /** When the daily purge deletes it for good. */
  readonly purgeAt: string;
}

export interface TrashPage {
  readonly items: readonly TrashItem[];
  /** Pass as `cursor` for the next page; null on the last one. */
  readonly nextCursor: string | null;
  /** What the actor may do with the items, for the UI. */
  readonly can: { readonly restore: boolean; readonly purge: boolean };
}

interface Entry {
  readonly entity: TrashableEntity;
  readonly row: TrashableRow;
  readonly position: TrashPosition;
}

/**
 * The actor's workspace's trash, most recently trashed first, across every trashable
 * entity (or one `type`), a page at a time.
 */
export async function listTrash(
  deps: {
    readonly db: Database;
    readonly entities: readonly TrashableEntity[];
  },
  actor: Actor,
  input: TrashListInput
): Promise<TrashPage> {
  requirePermission(actor, "trash.read");
  const query = trashListInputSchema.parse(input);
  const entities = query.type
    ? deps.entities.filter((entity) => entity.type === query.type)
    : deps.entities;
  if (entities.length === 0) {
    throw new InvalidTrashInputError(`Unknown trash item type: ${query.type}`);
  }
  const cursor = query.cursor ? decodeTrashCursor(query.cursor) : null;
  const limit = query.limit ?? TRASH_PAGE_SIZE_DEFAULT;

  // Each type's next `limit + 1` rows in the shared order; merged, they hold the page.
  const perEntity = await Promise.all(
    entities.map(async (entity): Promise<Entry[]> => {
      const t = entity.table;
      const where: (SQL | undefined)[] = [trashedIn(t, actor)];
      if (cursor) {
        const start = trashPageStart(entity.type, cursor);
        const at = new Date(start.beforeMs);
        where.push(
          or(
            lt(t.deletedAt, at),
            start.sameMs
              ? and(
                  eq(t.deletedAt, at),
                  start.sameMs.afterId === null
                    ? undefined
                    : gt(t.id, start.sameMs.afterId)
                )
              : undefined
          )
        );
      }
      const rows = (await deps.db
        .select()
        .from(t)
        .where(and(...where))
        .orderBy(desc(t.deletedAt), asc(t.id))
        .limit(limit + 1)) as unknown as TrashableRow[];
      return rows.map((row) => ({
        entity,
        row,
        position: {
          deletedAtMs: (row.deletedAt as Date).getTime(),
          type: entity.type,
          id: row.id,
        },
      }));
    })
  );
  const merged = perEntity
    .flat()
    .sort((a, b) => compareTrashPositions(a.position, b.position));
  const page = merged.slice(0, limit);
  const last = page.at(-1);

  const names = await deleterNames(
    deps.db,
    page.map((entry) => entry.row.deletedBy)
  );
  return {
    items: page.map(({ entity, row }) => {
      const summary = entity.summarize(row);
      const deletedAt = row.deletedAt as Date;
      const deletedBy = row.deletedBy ? names.get(row.deletedBy) : undefined;
      return {
        type: entity.type,
        id: row.id,
        label: summary.label,
        sizeBytes: summary.sizeBytes,
        deletedAt: deletedAt.toISOString(),
        deletedBy:
          row.deletedBy && deletedBy !== undefined
            ? { userId: row.deletedBy, name: deletedBy }
            : null,
        purgeAt: trashPurgeAt(deletedAt, entity.retentionDays).toISOString(),
      };
    }),
    nextCursor:
      merged.length > limit && last ? encodeTrashCursor(last.position) : null,
    can: {
      restore: can(actor.role, "trash.restore"),
      purge: can(actor.role, "trash.purge"),
    },
  };
}

/** Display names of the users who trashed the page's items. */
async function deleterNames(
  db: Database,
  userIds: readonly (string | null)[]
): Promise<Map<string, string>> {
  const unique = [
    ...new Set(userIds.filter((id): id is string => id !== null)),
  ];
  const names = new Map<string, string>();
  for (const ids of chunked(unique, 50)) {
    const rows = await db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(inArray(user.id, ids));
    for (const row of rows) names.set(row.id, row.name);
  }
  return names;
}
