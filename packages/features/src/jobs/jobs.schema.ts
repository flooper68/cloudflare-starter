import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Idempotency keys of jobs that define one: a run claims its key before the handler runs
 * (`in_progress`, locked for 15 minutes) and marks it `done` after. A duplicate finds the
 * key and is skipped. Rows expire after 7 days and are purged daily
 * (`jobs.purge-idempotency-keys`). No job history: failures go to the error reporter and
 * the dead-letter queue (docs/guides/how-to-add-background-jobs.md).
 */
export const jobIdempotencyKeys = sqliteTable(
  "job_idempotency_keys",
  {
    key: text("key").primaryKey(),
    jobType: text("job_type").notNull(),
    /** The envelope id of the run that holds or completed the key. */
    jobId: text("job_id").notNull(),
    status: text("status", { enum: ["in_progress", "done"] }).notNull(),
    /** Until when an in-progress claim blocks other runs; null once done. */
    lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("job_idempotency_keys_expires_at_idx").on(table.expiresAt)]
);
