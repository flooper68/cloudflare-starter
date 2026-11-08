import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * The QA outbox: mail the app would have sent to a QA address (QA_BYPASS=on), stored
 * instead of sent, fully rendered, for the automated QA suite to read
 * (GET /api/qa/outbox). Kept 24 hours; the daily `qa-outbox.purge` job deletes older rows.
 * Platform table: QA mail belongs to no workspace.
 */
export const qaOutbox = sqliteTable(
  "qa_outbox",
  {
    id: text("id").primaryKey(),
    /** The QA address, lowercased, with its `+tag`. */
    recipient: text("recipient").notNull(),
    /** The From the message would have had (EMAIL_FROM, with its display name). */
    sender: text("sender").notNull(),
    subject: text("subject").notNull(),
    textBody: text("text_body").notNull(),
    htmlBody: text("html_body").notNull(),
    /** Every header the message would have had, lowercase names. */
    headers: text("headers", { mode: "json" })
      .$type<Record<string, string>>()
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("qa_outbox_recipient_idx").on(table.recipient, table.createdAt),
    index("qa_outbox_created_at_idx").on(table.createdAt),
  ]
);
