import { and, desc, or, sql } from "drizzle-orm";

import type { Database } from "../database";
import { liveIn } from "../trash";
import { type Actor, requirePermission } from "../workspaces";
import {
  type NoteSearchHit,
  noteExcerpt,
  type SearchNotesInput,
  searchNotesInputSchema,
} from "./domain";
import { notes } from "./notes.schema";

/** `%`, `_` and `\` match literally in a LIKE search. */
function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/**
 * The live notes of the actor's workspace (never those in its trash) whose title or body
 * contains `query`, ignoring case for ASCII letters only (SQLite's LIKE): title matches
 * first, then the most recently changed. One query, capped at `limit`. A `LIKE '%…%'` cannot use an index, so this
 * scans the workspace's notes (the workspace index narrows it to them); a project with
 * large workspaces moves it to an FTS5 table (docs/guides/how-to-add-a-feature.md).
 */
export async function searchNotes(
  deps: { readonly db: Database },
  actor: Actor,
  input: SearchNotesInput
): Promise<{ readonly items: readonly NoteSearchHit[] }> {
  requirePermission(actor, "notes.read");
  const parsed = searchNotesInputSchema.parse(input);
  const pattern = likePattern(parsed.query);
  const inTitle = sql<number>`(${notes.title} LIKE ${pattern} ESCAPE '\\')`;
  const rows = await deps.db
    .select({
      id: notes.id,
      title: notes.title,
      // Enough for the excerpt: a body can be 20,000 characters.
      body: sql<string>`substr(${notes.body}, 1, 1000)`,
      inTitle,
    })
    .from(notes)
    .where(
      and(
        liveIn(notes, actor),
        or(inTitle, sql`${notes.body} LIKE ${pattern} ESCAPE '\\'`)
      )
    )
    .orderBy(desc(inTitle), desc(notes.updatedAt), desc(notes.id))
    .limit(parsed.limit);
  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      excerpt: noteExcerpt(row.body),
      matched: row.inTitle ? "title" : "body",
    })),
  };
}
