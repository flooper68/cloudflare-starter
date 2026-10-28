import { InvalidTrashInputError } from "./errors";

const DAY_MS = 24 * 60 * 60 * 1000;

function requireRetentionDays(retentionDays: number): void {
  if (!Number.isInteger(retentionDays) || retentionDays < 1) {
    throw new InvalidTrashInputError(
      "Trash retention must be a whole number of days, at least 1"
    );
  }
}

/** When an item trashed at `deletedAt` is purged: `retentionDays` later. */
export function trashPurgeAt(deletedAt: Date, retentionDays: number): Date {
  requireRetentionDays(retentionDays);
  return new Date(deletedAt.getTime() + retentionDays * DAY_MS);
}

/**
 * Items trashed at or before this instant are past retention as of `now`: their purge time
 * (`trashPurgeAt`) is not after `now`.
 */
export function trashPurgeCutoff(now: Date, retentionDays: number): Date {
  requireRetentionDays(retentionDays);
  return new Date(now.getTime() - retentionDays * DAY_MS);
}

/** Whole days left before the purge, rounded up; 0 once it is due. */
export function daysUntilPurge(
  deletedAt: Date,
  retentionDays: number,
  now: Date
): number {
  const left = trashPurgeAt(deletedAt, retentionDays).getTime() - now.getTime();
  return left <= 0 ? 0 : Math.ceil(left / DAY_MS);
}
