import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";

import type { AuditTrashTargetType } from "../audit";
import type { Database } from "../database";
import type { BillingGate } from "../kernel";
import type { Action, Actor } from "../workspaces";
import { InvalidTrashInputError } from "./domain";

/**
 * A table whose rows can sit in a workspace's trash: `id`, `workspace_id`, and the
 * nullable `deleted_at` (timestamp_ms) and `deleted_by` (FK user, ON DELETE SET NULL),
 * with the partial index `(workspace_id, deleted_at) WHERE deleted_at IS NOT NULL`.
 */
export type TrashableTable = SQLiteTable & {
  readonly id: SQLiteColumn;
  readonly workspaceId: SQLiteColumn;
  readonly deletedAt: SQLiteColumn;
  readonly deletedBy: SQLiteColumn;
};

/** The columns every trashable row has. */
export interface TrashableRow {
  readonly id: string;
  readonly workspaceId: string;
  readonly deletedAt: Date | null;
  readonly deletedBy: string | null;
}

/** How a trashed row shows in the trash list. */
export interface TrashItemSummary {
  /** What people recognise it by: a filename, a title. */
  readonly label: string;
  /** Bytes it still stores, if it stores any. */
  readonly sizeBytes: number | null;
}

/** What an entity's restore check may read. */
export interface TrashRestoreDeps {
  readonly db: Database;
  readonly billing: BillingGate;
}

/** What an entity's purge may use: the database and the `FILES` bucket. */
export interface TrashPurgeDeps {
  readonly db: Database;
  readonly bucket: R2Bucket;
}

/**
 * The contract between the trash and a feature whose rows can be trashed. The feature
 * owns its table and how its rows are summarised, checked before restore and deleted for
 * good; the trash owns listing, restore, permanent delete, emptying and retention.
 * Registered in packages/features/src/trash-catalog.ts.
 */
export interface TrashableEntity<TRow extends TrashableRow = TrashableRow> {
  /** The item type in the API and the audit target type (`file`). */
  readonly type: AuditTrashTargetType;
  readonly table: TrashableTable;
  /** Days an item stays in the trash before the daily purge deletes it. */
  readonly retentionDays: number;
  /** The entity's write permission: restoring needs it on top of `trash.restore`. */
  readonly permission: Action;
  summarize(row: TRow): TrashItemSummary;
  /**
   * Throws a DomainError when these rows may not come back: a count-based plan limit,
   * a unique name a live row took meanwhile. Rows are all of the actor's workspace.
   */
  checkRestore(
    deps: TrashRestoreDeps,
    actor: Actor,
    rows: readonly TRow[]
  ): Promise<void>;
  /**
   * Deletes these rows for good, and whatever they own outside D1 (R2 objects first,
   * rows last, so a failure leaves rows to retry rather than orphaned objects).
   * Idempotent; checks nothing: callers choose the ids (the trash through `trashedIn`,
   * account erasure for a workspace being deleted).
   */
  purge(
    deps: TrashPurgeDeps,
    ids: readonly string[]
  ): Promise<{ readonly purged: number }>;
}

/** Declares a trashable entity; refuses a retention that is not a whole number of days. */
export function defineTrashableEntity<TRow extends TrashableRow>(
  entity: TrashableEntity<TRow>
): TrashableEntity<TRow> {
  if (!Number.isInteger(entity.retentionDays) || entity.retentionDays < 1) {
    throw new InvalidTrashInputError(
      `Trash retention of ${entity.type} must be a whole number of days, at least 1`
    );
  }
  return Object.freeze({ ...entity });
}
