import { and, eq } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { liveIn } from "../trash";
import { type Actor, requirePermission } from "../workspaces";
import {
  type AddNoteCommentInput,
  addNoteCommentInputSchema,
  NoteNotFoundError,
} from "./domain";
import { noteComments, notes } from "./notes.schema";

/**
 * Adds a comment to a live note of the actor's workspace (`notes.write`). Records
 * `note.commented` (the comment's id, never its text).
 */
export async function addNoteComment(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  actor: Actor,
  input: AddNoteCommentInput
): Promise<{ readonly id: string; readonly createdAt: string }> {
  requirePermission(actor, "notes.write");
  const parsed = addNoteCommentInputSchema.parse(input);
  const [note] = await deps.db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.id, parsed.noteId), liveIn(notes, actor)))
    .limit(1);
  if (!note) throw new NoteNotFoundError();

  const id = deps.ids.uuid();
  const now = deps.clock.now();
  await deps.db.insert(noteComments).values({
    id,
    workspaceId: actor.workspaceId,
    noteId: note.id,
    body: parsed.body,
    createdBy: actor.userId,
    createdAt: now,
  });
  await recordAuditEvent(deps, deps.requestContext, {
    action: "note.commented",
    actor: { kind: "user", userId: actor.userId },
    workspaceId: actor.workspaceId,
    target: { type: "note", id: note.id },
    metadata: { commentId: id },
  });
  return { id, createdAt: now.toISOString() };
}
