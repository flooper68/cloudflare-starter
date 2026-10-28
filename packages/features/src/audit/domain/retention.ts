import { InvalidAuditInputError } from "./errors";

/**
 * How long audit events are kept before the daily purge deletes them. 400 days covers a
 * yearly review plus a margin; a project changes it here (compliance may ask for more).
 */
export const AUDIT_RETENTION_DAYS = 400;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Events that occurred strictly before this instant are past retention. */
export function auditRetentionCutoff(
  now: Date,
  retentionDays: number = AUDIT_RETENTION_DAYS
): Date {
  if (!Number.isInteger(retentionDays) || retentionDays < 1) {
    throw new InvalidAuditInputError(
      "Retention must be a whole number of days, at least 1"
    );
  }
  return new Date(now.getTime() - retentionDays * DAY_MS);
}
