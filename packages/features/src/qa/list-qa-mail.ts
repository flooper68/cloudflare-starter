import { and, desc, eq, gte, sql } from "drizzle-orm";

import type { Database } from "../database";
import type { Clock } from "../kernel";
import { QA_OUTBOX_PAGE_SIZE, qaOutboxCutoff } from "./domain";
import { qaOutbox } from "./qa.schema";

/** One stored message, as GET /api/qa/outbox returns it. */
export interface QaMail {
  readonly id: string;
  readonly to: string;
  readonly from: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  /** Lowercase names: from, to, subject, date, message-id, list-unsubscribe, … */
  readonly headers: Readonly<Record<string, string>>;
  /** When the app stored it instead of sending it, ISO 8601. */
  readonly receivedAt: string;
}

/**
 * The QA outbox's mail to `to`, newest first, at most 50: only mail stored since `since`
 * and within the last 24 hours, and, with `subject`, whose subject contains it
 * (case-insensitive). The caller checks that `to` is a QA run address.
 */
export async function listQaMail(
  deps: { readonly db: Database; readonly clock: Clock },
  input: {
    readonly to: string;
    readonly since: Date | null;
    readonly subject: string | null;
  }
): Promise<QaMail[]> {
  const cutoff = qaOutboxCutoff(deps.clock.now());
  const after =
    input.since && input.since.getTime() > cutoff.getTime()
      ? input.since
      : cutoff;
  const rows = await deps.db
    .select()
    .from(qaOutbox)
    .where(
      and(
        eq(qaOutbox.recipient, input.to.trim().toLowerCase()),
        gte(qaOutbox.createdAt, after),
        input.subject
          ? sql`instr(lower(${qaOutbox.subject}), lower(${input.subject})) > 0`
          : undefined
      )
    )
    .orderBy(desc(qaOutbox.createdAt), desc(qaOutbox.id))
    .limit(QA_OUTBOX_PAGE_SIZE);
  return rows.map((row) => ({
    id: row.id,
    to: row.recipient,
    from: row.sender,
    subject: row.subject,
    text: row.textBody,
    html: row.htmlBody,
    headers: row.headers,
    receivedAt: row.createdAt.toISOString(),
  }));
}
