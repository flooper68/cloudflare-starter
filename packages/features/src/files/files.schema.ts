import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "../accounts";
import { workspaces } from "../workspaces";

import { FILE_BUCKETS } from "./domain";

/** A file belongs to a workspace; `created_by` records who uploaded it, nothing more. */
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
  },
  (table) => [
    index("files_workspace_id_created_at_idx").on(
      table.workspaceId,
      table.createdAt
    ),
  ]
);
