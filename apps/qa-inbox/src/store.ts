import { MAX_RESULTS, RETENTION_MS } from "./env";

/** A stored message, as the HTTP API returns it. */
export interface InboxMessage {
  readonly id: string;
  /** The QA address it was delivered to (envelope recipient, lowercased). */
  readonly to: string;
  readonly from: string;
  readonly subject: string;
  /** The Date header as ISO 8601, or null. */
  readonly date: string | null;
  /** When the inbox received it, ISO 8601. */
  readonly receivedAt: string;
  readonly text: string | null;
  readonly html: string | null;
  /**
   * Every header by lowercase name; repeated headers are joined with ", " (RFC 9110).
   * Includes `list-unsubscribe` and `list-unsubscribe-post` when the mail has them.
   */
  readonly headers: Readonly<Record<string, string>>;
}

export interface NewMessage {
  readonly id: string;
  readonly to: string;
  readonly from: string;
  readonly subject: string;
  readonly date: string | null;
  readonly receivedAt: number;
  readonly text: string | null;
  readonly html: string | null;
  /** [lowercase name, value] in document order, duplicates included. */
  readonly headers: readonly (readonly [string, string])[];
}

interface Row {
  readonly id: string;
  readonly recipient: string;
  readonly sender: string;
  readonly subject: string;
  readonly sent_at: string | null;
  readonly received_at: number;
  readonly text_body: string | null;
  readonly html_body: string | null;
  readonly headers: string;
}

export async function insertMessage(
  db: D1Database,
  message: NewMessage
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO messages (id, recipient, sender, subject, sent_at, received_at, text_body, html_body, headers)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      message.id,
      message.to,
      message.from,
      message.subject,
      message.date,
      message.receivedAt,
      message.text,
      message.html,
      JSON.stringify(message.headers)
    )
    .run();
}

/**
 * Messages to `to` received since `since` (ms) and within the retention window, whose
 * subject contains `subject` (case-insensitive) when given; newest first.
 */
export async function findMessages(
  db: D1Database,
  query: {
    readonly to: string;
    readonly since: number | null;
    readonly subject: string | null;
    readonly now: number;
  }
): Promise<InboxMessage[]> {
  const after = Math.max(query.since ?? 0, query.now - RETENTION_MS);
  const subjectFilter = query.subject
    ? "AND instr(lower(subject), lower(?)) > 0"
    : "";
  const bindings: (string | number)[] = [query.to, after];
  if (query.subject) bindings.push(query.subject);
  bindings.push(MAX_RESULTS);
  const { results } = await db
    .prepare(
      `SELECT * FROM messages WHERE recipient = ? AND received_at >= ? ${subjectFilter}
       ORDER BY received_at DESC, id DESC LIMIT ?`
    )
    .bind(...bindings)
    .all<Row>();
  return results.map(toMessage);
}

/** Deletes every message to `to`; returns how many. */
export async function deleteMessages(
  db: D1Database,
  to: string
): Promise<number> {
  const result = await db
    .prepare("DELETE FROM messages WHERE recipient = ?")
    .bind(to)
    .run();
  return result.meta.changes ?? 0;
}

/** Deletes every message older than the retention window; returns how many. */
export async function purgeExpired(
  db: D1Database,
  now: number
): Promise<number> {
  const result = await db
    .prepare("DELETE FROM messages WHERE received_at < ?")
    .bind(now - RETENTION_MS)
    .run();
  return result.meta.changes ?? 0;
}

function toMessage(row: Row): InboxMessage {
  const headers: Record<string, string> = {};
  for (const [name, value] of JSON.parse(row.headers) as [string, string][]) {
    headers[name] = name in headers ? `${headers[name]}, ${value}` : value;
  }
  return {
    id: row.id,
    to: row.recipient,
    from: row.sender,
    subject: row.subject,
    date: row.sent_at,
    receivedAt: new Date(row.received_at).toISOString(),
    text: row.text_body,
    html: row.html_body,
    headers,
  };
}
