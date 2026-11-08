import { and, eq } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { liveIn } from "../trash";
import { type Actor, requirePermission } from "../workspaces";
import {
  NoteNotFoundError,
  type UpdateNoteInput,
  updateNoteInputSchema,
} from "./domain";
import { notes } from "./notes.schema";

/**
 * Changes the title and/or body of a live note of the actor's workspace (`notes.write`).
 * Records `note.updated` with which fields changed (never their text).
 */
export async function updateNote(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  actor: Actor,
  input: UpdateNoteInput
): Promise<{ readonly id: string; readonly updatedAt: string }> {
  requirePermission(actor, "notes.write");
  const parsed = updateNoteInputSchema.parse(input);
  const now = deps.clock.now();
  const changed = await deps.db
    .update(notes)
    .set({
      ...(parsed.title !== undefined ? { title: parsed.title } : {}),
      ...(parsed.body !== undefined ? { body: parsed.body } : {}),
      updatedBy: actor.userId,
      updatedAt: now,
    })
    .where(and(eq(notes.id, parsed.noteId), liveIn(notes, actor)))
    .returning({ id: notes.id });
  if (changed.length === 0) throw new NoteNotFoundError();

  await recordAuditEvent(deps, deps.requestContext, {
    action: "note.updated",
    actor: { kind: "user", userId: actor.userId },
    workspaceId: actor.workspaceId,
    target: { type: "note", id: parsed.noteId },
    metadata: {
      fields: [
        ...(parsed.title !== undefined ? (["title"] as const) : []),
        ...(parsed.body !== undefined ? (["body"] as const) : []),
      ],
    },
  });
  return { id: parsed.noteId, updatedAt: now.toISOString() };
}
