import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const FILE_BUCKETS = ["files"] as const;
export type FileBucket = (typeof FILE_BUCKETS)[number];

export const files = sqliteTable("files", {
  id: text("id").primaryKey(),
  bucket: text("bucket", { enum: FILE_BUCKETS }).notNull(),
  r2Key: text("r2_key").notNull().unique(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
});
