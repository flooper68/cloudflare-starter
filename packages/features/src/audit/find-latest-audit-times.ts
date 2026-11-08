import { and, eq, inArray, max } from "drizzle-orm";

import type { Database } from "../database";
import { auditEvents } from "./audit.schema";
import type { AuditAction, AuditTargetType } from "./domain";

/** D1 binds at most 100 parameters per statement. */
const CHUNK = 50;

/**
 * When `action` last happened to each of `targetIds` (of `targetType`), for the targets
 * it happened to at all. For features whose rule depends on an audited system action
 * (the demo retention erases only accounts it warned).
 */
export async function findLatestAuditTimes(
  deps: { readonly db: Database },
  input: {
    readonly action: AuditAction;
    readonly targetType: AuditTargetType;
    readonly targetIds: readonly string[];
  }
): Promise<Map<string, Date>> {
  const latest = new Map<string, Date>();
  for (let i = 0; i < input.targetIds.length; i += CHUNK) {
    const found = await deps.db
      .select({ id: auditEvents.targetId, at: max(auditEvents.occurredAt) })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.action, input.action),
          eq(auditEvents.targetType, input.targetType),
          inArray(auditEvents.targetId, input.targetIds.slice(i, i + CHUNK))
        )
      )
      .groupBy(auditEvents.targetId);
    for (const row of found) if (row.at) latest.set(row.id, row.at);
  }
  return latest;
}
