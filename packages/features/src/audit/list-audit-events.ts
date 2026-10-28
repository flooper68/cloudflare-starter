import {
  and,
  desc,
  eq,
  getTableColumns,
  gte,
  lt,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import type { Database } from "../database";
import { auditEvents } from "./audit.schema";
import {
  type AuditEvent,
  type AuditQueryInput,
  auditQuerySchema,
  decodeAuditCursor,
  encodeAuditCursor,
  InvalidAuditInputError,
  toAuditEvent,
} from "./domain";

export interface AuditEventPage {
  readonly events: readonly AuditEvent[];
  /** Pass as `cursor` for the next page; null on the last page. */
  readonly nextCursor: string | null;
}

/**
 * SQLite's rowid: audit_events is a rowid table that is only appended to (and purged from
 * the oldest end), so it is the insertion order. Every index includes it.
 */
const insertionSeq = sql<number>`${auditEvents}.rowid`;

/**
 * Audit events matching the filters, newest first, one page at a time. Events recorded in
 * the same millisecond come in reverse insertion order (the rowid), so "newest first" holds
 * within a request too. Keyset pagination on (occurred_at, rowid) keeps pages stable while
 * new events arrive.
 */
export async function listAuditEvents(
  deps: { readonly db: Database },
  input: AuditQueryInput = {}
): Promise<AuditEventPage> {
  const parsed = auditQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new InvalidAuditInputError(
      `Invalid audit log query: ${z.prettifyError(parsed.error)}`
    );
  }
  const query = parsed.data;

  const conditions: (SQL | undefined)[] = [
    query.actorUserId
      ? eq(auditEvents.actorUserId, query.actorUserId)
      : undefined,
    query.action ? eq(auditEvents.action, query.action) : undefined,
    query.targetType ? eq(auditEvents.targetType, query.targetType) : undefined,
    query.targetId ? eq(auditEvents.targetId, query.targetId) : undefined,
    query.workspaceId
      ? eq(auditEvents.workspaceId, query.workspaceId)
      : undefined,
    query.from ? gte(auditEvents.occurredAt, new Date(query.from)) : undefined,
    query.to ? lt(auditEvents.occurredAt, new Date(query.to)) : undefined,
  ];
  if (query.cursor) {
    const cursor = decodeAuditCursor(query.cursor);
    const at = new Date(cursor.occurredAtMs);
    conditions.push(
      or(
        lt(auditEvents.occurredAt, at),
        and(eq(auditEvents.occurredAt, at), lt(insertionSeq, cursor.seq))
      )
    );
  }

  const rows = await deps.db
    .select({ ...getTableColumns(auditEvents), seq: insertionSeq })
    .from(auditEvents)
    .where(and(...conditions))
    .orderBy(desc(auditEvents.occurredAt), desc(insertionSeq))
    .limit(query.limit + 1);

  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    events: page.map(({ seq: _seq, ...row }) => toAuditEvent(row)),
    nextCursor:
      rows.length > query.limit && last
        ? encodeAuditCursor({
            occurredAtMs: last.occurredAt.getTime(),
            seq: last.seq,
          })
        : null,
  };
}
