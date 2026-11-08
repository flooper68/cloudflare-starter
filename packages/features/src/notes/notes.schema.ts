import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "../accounts";
import { workspaces } from "../workspaces";

/**
 * A note belongs to a workspace (the placeholder Notes app); `created_by` and
 * `updated_by` record who wrote it, nothing more. Trashable
 * (docs/guides/how-to-use-trash.md): a set `deleted_at` means the note is in the
 * workspace's trash, so every read filters with `liveIn` or `trashedIn` (trash/).
 */
export const notes = sqliteTable(
  "notes",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedBy: text("updated_by").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    /** When the note was moved to the trash; null while it is live. */
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    /** Who moved it to the trash; attribution only. */
    deletedBy: text("deleted_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    // The list: a workspace's notes, most recently changed first.
    index("notes_workspace_id_updated_at_idx").on(
      table.workspaceId,
      table.updatedAt
    ),
    index("notes_workspace_id_deleted_at_idx")
      .on(table.workspaceId, table.deletedAt)
      .where(sql`${table.deletedAt} IS NOT NULL`),
  ]
);

/**
 * A comment on a note. It goes with its note: trashed with it (reads go through the
 * note's `liveIn`), deleted with it (ON DELETE CASCADE) when the note is purged.
 */
export const noteComments = sqliteTable(
  "note_comments",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    // The note's comments, oldest first.
    index("note_comments_workspace_id_note_id_created_at_idx").on(
      table.workspaceId,
      table.noteId,
      table.createdAt
    ),
    // The ON DELETE CASCADE from a purged note looks comments up by note_id alone.
    index("note_comments_note_id_idx").on(table.noteId),
  ]
);
