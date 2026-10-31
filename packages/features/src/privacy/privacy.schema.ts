import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
/** No foreign keys: explicit cleanup owns uploads, and the minimal erasure ledger must survive deletion. */
export const dataRequests = sqliteTable(
  "data_requests",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    scope: text("scope", { enum: ["user", "workspace"] }).notNull(),
    subjectId: text("subject_id").notNull(),
    status: text("status", {
      enum: ["queued", "building", "ready", "failed", "expired"],
    }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    objectKey: text("object_key"),
    uploadId: text("upload_id"),
    attemptId: text("attempt_id"),
    leaseUntil: integer("lease_until", { mode: "timestamp_ms" }),
    sizeBytes: integer("size_bytes"),
    failure: text("failure"),
  },
  (t) => [
    uniqueIndex("data_requests_one_active_idx")
      .on(t.scope, t.subjectId)
      .where(sql`${t.status} in ('queued','building')`),
    index("data_requests_subject_created_idx").on(
      t.scope,
      t.subjectId,
      t.createdAt
    ),
    index("data_requests_user_created_idx").on(t.userId, t.createdAt),
    index("data_requests_expiry_idx").on(t.expiresAt),
  ]
);
export const erasureRecords = sqliteTable("erasure_records", {
  userId: text("user_id").primaryKey(),
  requestedAt: integer("requested_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
});

/** Serialize account erasure across before/after auth hooks, protecting last-owner/admin checks. */
export const erasureLock = sqliteTable("privacy_erasure_lock", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  operationId: text("operation_id").notNull(),
  leaseUntil: integer("lease_until", { mode: "timestamp_ms" }).notNull(),
});
