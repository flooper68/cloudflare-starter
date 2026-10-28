/**
 * How long inbox rows are kept before the daily purge deletes them: read or archived ones
 * for 90 days, unread ones for a year (someone back from a long leave still finds them).
 * A project changes them here.
 */
export const READ_RETENTION_DAYS = 90;
export const UNREAD_RETENTION_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Rows created strictly before these instants are past retention. */
export function notificationRetentionCutoffs(now: Date): {
  readonly readBefore: Date;
  readonly unreadBefore: Date;
} {
  return {
    readBefore: new Date(now.getTime() - READ_RETENTION_DAYS * DAY_MS),
    unreadBefore: new Date(now.getTime() - UNREAD_RETENTION_DAYS * DAY_MS),
  };
}
