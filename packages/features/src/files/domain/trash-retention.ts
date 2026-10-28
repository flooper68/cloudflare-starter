/**
 * Days a file stays in the trash before the daily purge deletes it and its R2 object.
 * Trashed files keep counting toward `storage_bytes` until then (R2 still stores them).
 */
export const FILE_TRASH_RETENTION_DAYS = 30;
