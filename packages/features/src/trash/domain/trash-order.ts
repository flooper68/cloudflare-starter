import { InvalidTrashInputError } from "./errors";

/**
 * The trash lists items of every entity type in one order: most recently trashed first,
 * then by type and id, so items trashed in the same millisecond keep a stable order and a
 * page can end anywhere. A cursor is the position of a page's last item.
 */
export interface TrashPosition {
  readonly deletedAtMs: number;
  readonly type: string;
  readonly id: string;
}

/** Negative when `a` comes first in the trash list. */
export function compareTrashPositions(a: TrashPosition, b: TrashPosition) {
  if (a.deletedAtMs !== b.deletedAtMs) return b.deletedAtMs - a.deletedAtMs;
  if (a.type !== b.type) return a.type < b.type ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

/** Opaque to clients: `<epoch ms>:<type>:<id>`. */
export function encodeTrashCursor(position: TrashPosition): string {
  return `${position.deletedAtMs}:${position.type}:${position.id}`;
}

export function decodeTrashCursor(value: string): TrashPosition {
  const [ms, type, ...rest] = value.split(":");
  const id = rest.join(":");
  if (!ms || !/^\d+$/.test(ms) || !type || !id) {
    throw new InvalidTrashInputError("Invalid trash cursor");
  }
  return { deletedAtMs: Number(ms), type, id };
}

/**
 * Where, for one entity type, the items after `cursor` start: those trashed earlier, plus
 * those trashed in the same millisecond that sort after it. `sameMs` is null when no item
 * of this type in that millisecond can follow, or the id they must exceed.
 */
export function trashPageStart(
  type: string,
  cursor: TrashPosition
): {
  readonly beforeMs: number;
  readonly sameMs: { readonly afterId: string | null } | null;
} {
  if (type > cursor.type)
    return { beforeMs: cursor.deletedAtMs, sameMs: { afterId: null } };
  if (type < cursor.type) return { beforeMs: cursor.deletedAtMs, sameMs: null };
  return { beforeMs: cursor.deletedAtMs, sameMs: { afterId: cursor.id } };
}
