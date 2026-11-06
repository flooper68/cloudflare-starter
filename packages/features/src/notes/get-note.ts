import { aliasedTable, and, asc, eq } from "drizzle-orm";

import { user } from "../accounts";
import type { Database } from "../database";
import { liveIn } from "../trash";
import { type Actor, requirePermission } from "../workspaces";
import {
  NoteNotFoundError,
  type NotePerson,
  type NoteSummary,
  toNoteSummary,
} from "./domain";
import { noteComments, notes } from "./notes.schema";

export interface NoteComment {
  readonly id: string;
  readonly body: string;
  readonly author: NotePerson | null;
  readonly createdAt: string;
}

export interface NoteDetail extends NoteSummary {
  readonly body: string;
  /** Oldest first, like a conversation. */
  readonly comments: readonly NoteComment[];
}

/** A live note of the actor's workspace with its body and comments (`notes.read`). */
export async function getNote(
  deps: { readonly db: Database },
  actor: Actor,
  input: { readonly noteId: string }
): Promise<NoteDetail> {
  requirePermission(actor, "notes.read");
  const creator = aliasedTable(user, "creator");
  const editor = aliasedTable(user, "editor");
  const [row] = await deps.db
    .select({
      id: notes.id,
      title: notes.title,
      body: notes.body,
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
    .where(and(eq(notes.id, input.noteId), liveIn(notes, actor)))
    .limit(1);
  if (!row) throw new NoteNotFoundError();

  const comments = await deps.db
    .select({
      id: noteComments.id,
      body: noteComments.body,
      createdBy: noteComments.createdBy,
      authorName: user.name,
      createdAt: noteComments.createdAt,
    })
    .from(noteComments)
    .leftJoin(user, eq(user.id, noteComments.createdBy))
    .where(
      and(
        eq(noteComments.workspaceId, actor.workspaceId),
        eq(noteComments.noteId, row.id)
      )
    )
    .orderBy(asc(noteComments.createdAt), asc(noteComments.id));

  return {
    ...toNoteSummary(row, comments.length),
    body: row.body,
    comments: comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      author:
        comment.createdBy && comment.authorName !== null
          ? { userId: comment.createdBy, name: comment.authorName }
          : null,
      createdAt: comment.createdAt.toISOString(),
    })),
  };
}
