import { inArray, lt } from "drizzle-orm";

import type { Database } from "../database";
import type { Clock } from "../kernel";
import { auditEvents } from "./audit.schema";
import { AUDIT_RETENTION_DAYS, auditRetentionCutoff } from "./domain";

/** Rows deleted per statement, so one run never holds a long write on D1. */
const PURGE_BATCH = 500;

/**
 * Deletes audit events older than the retention period (AUDIT_RETENTION_DAYS by default),
 * in batches. The only use case that deletes audit rows; run daily by the cron handler.
 */
export async function purgeAuditEvents(
  deps: { readonly db: Database; readonly clock: Clock },
  input: { readonly retentionDays?: number } = {}
): Promise<{ readonly deleted: number; readonly cutoff: string }> {
  const cutoff = auditRetentionCutoff(
    deps.clock.now(),
    input.retentionDays ?? AUDIT_RETENTION_DAYS
  );
  let deleted = 0;
  for (;;) {
    const expired = deps.db
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .where(lt(auditEvents.occurredAt, cutoff))
      .limit(PURGE_BATCH);
    const result = await deps.db
      .delete(auditEvents)
      .where(inArray(auditEvents.id, expired))
      .run();
    const changes = result.meta.changes ?? 0;
    deleted += changes;
    if (changes < PURGE_BATCH) break;
  }
  return { deleted, cutoff: cutoff.toISOString() };
}
