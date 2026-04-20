import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users";

export const FILE_BUCKETS = ["files"] as const;
export type FileBucket = (typeof FILE_BUCKETS)[number];

export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  bucket: text("bucket", { enum: FILE_BUCKETS }).notNull(),
  r2Key: text("r2_key").notNull().unique(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  })
    .notNull()
    .defaultNow(),
});
