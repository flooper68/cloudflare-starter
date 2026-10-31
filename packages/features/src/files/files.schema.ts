import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "../accounts";
import { workspaces } from "../workspaces";

import { FILE_BUCKETS } from "./domain";

/**
 * A file belongs to a workspace; `created_by` records who uploaded it, nothing more.
 * Trashable (docs/guides/how-to-use-trash.md): a set `deleted_at` means the file is in the
 * workspace's trash, so every read filters with `liveIn` or `trashedIn` (trash/).
 */
export const files = sqliteTable(
  "files",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    bucket: text("bucket", { enum: FILE_BUCKETS }).notNull(),
    r2Key: text("r2_key").notNull().unique(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    /** When the file was moved to the trash; null while it is live. */
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    /** Who moved it to the trash; attribution only. */
    deletedBy: text("deleted_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("files_workspace_id_created_at_idx").on(
      table.workspaceId,
      table.createdAt
    ),
    // The trash list and the retention purge read only trashed rows: a partial index
    // stays as small as the trash (docs/architecture/performance.md).
    index("files_workspace_id_deleted_at_idx")
      .on(table.workspaceId, table.deletedAt)
      .where(sql`${table.deletedAt} IS NOT NULL`),
  ]
);

/** Temporary, non-cascading cleanup intents; keep targets until physical cleanup succeeds. */
export const pendingFileCleanup = sqliteTable(
  "pending_file_cleanup",
  {
    target: text("target").primaryKey(),
    kind: text("kind", { enum: ["upload", "erasure"] }).notNull(),
    workspaceId: text("workspace_id"),
    userId: text("user_id"),
    notBefore: integer("not_before", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    cursor: text("cursor"),
    sweep: integer("sweep").notNull().default(0),
  },
  (table) => [index("pending_file_cleanup_due_idx").on(table.notBefore)]
);
