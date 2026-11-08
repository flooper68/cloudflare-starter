import { and, count, eq, gte } from "drizzle-orm";

import type { Database } from "../database";
import { auditEvents } from "./audit.schema";
import type { AuditAction } from "./domain";

/** How many `action` events were recorded at or after `since` (overview counters). */
export async function countAuditEvents(
  deps: { readonly db: Database },
  input: { readonly action: AuditAction; readonly since: Date }
): Promise<number> {
  const [row] = await deps.db
    .select({ n: count() })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.action, input.action),
        gte(auditEvents.occurredAt, input.since)
      )
    );
  return row?.n ?? 0;
}
