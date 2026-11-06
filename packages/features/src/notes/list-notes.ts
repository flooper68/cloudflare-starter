import { aliasedTable, and, count, desc, eq, inArray, sql } from "drizzle-orm";

import { user } from "../accounts";
import type { Database } from "../database";
import { liveIn } from "../trash";
import { type Actor, requirePermission } from "../workspaces";
import {
  type ListNotesInput,
  listNotesInputSchema,
  type NoteSummary,
  toNoteSummary,
} from "./domain";
import { noteComments, notes } from "./notes.schema";

/** `%`, `_` and `\` match literally in a LIKE search. */
function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/**
 * The live notes of the actor's workspace (not those in its trash), most recently
 * changed first, optionally only those whose title contains `query`; with their
 * people and comment counts. Two queries, whatever the page size.
 */
export async function listNotes(
  deps: { readonly db: Database },
  actor: Actor,
  input: ListNotesInput
): Promise<{ readonly items: readonly NoteSummary[] }> {
  requirePermission(actor, "notes.read");
  const parsed = listNotesInputSchema.parse(input);
  const creator = aliasedTable(user, "creator");
  const editor = aliasedTable(user, "editor");
  const rows = await deps.db
    .select({
      id: notes.id,
      title: notes.title,
      // Enough for the excerpt: a body can be 20,000 characters.
      body: sql<string>`substr(${notes.body}, 1, 1000)`,
      createdBy: notes.createdBy,
      createdByName: creator.name,
      createdAt: notes.createdAt,
      updatedBy: notes.updatedBy,
      updatedByName: editor.name,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .leftJoin(creator, eq(creator.id, notes.createdBy))
    .leftJoin(editor, eq(editor.id, notes.updatedBy))
    .where(
      and(
        liveIn(notes, actor),
        parsed.query
          ? sql`${notes.title} LIKE ${likePattern(parsed.query)} ESCAPE '\\'`
          : undefined
      )
    )
    .orderBy(desc(notes.updatedAt), desc(notes.id))
    .limit(parsed.limit);
  if (rows.length === 0) return { items: [] };

  const counts = await deps.db
    .select({ noteId: noteComments.noteId, comments: count() })
    .from(noteComments)
    .where(
      and(
        eq(noteComments.workspaceId, actor.workspaceId),
        inArray(
          noteComments.noteId,
          rows.map((row) => row.id)
        )
      )
    )
    .groupBy(noteComments.noteId);
  const byNote = new Map(counts.map((row) => [row.noteId, row.comments]));
  return {
    items: rows.map((row) => toNoteSummary(row, byNote.get(row.id) ?? 0)),
  };
}
