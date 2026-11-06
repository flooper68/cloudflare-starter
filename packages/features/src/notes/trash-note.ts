import { and, eq } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { liveIn, trashPurgeAt } from "../trash";
import { type Actor, requirePermission } from "../workspaces";
import { NOTE_TRASH_RETENTION_DAYS, NoteNotFoundError } from "./domain";
import { notes } from "./notes.schema";

/**
 * Moves a live note of the actor's workspace to its trash (`notes.delete`), with its
 * comments: it leaves the list at once and stays restorable for
 * NOTE_TRASH_RETENTION_DAYS. Records `trash.item_trashed`.
 */
export async function trashNote(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  actor: Actor,
  input: { readonly noteId: string }
): Promise<{
  readonly type: "note";
  readonly id: string;
  readonly deletedAt: string;
  readonly purgeAt: string;
}> {
  requirePermission(actor, "notes.delete");
  const now = deps.clock.now();
  const trashed = await deps.db
    .update(notes)
    .set({ deletedAt: now, deletedBy: actor.userId })
    .where(and(eq(notes.id, input.noteId), liveIn(notes, actor)))
    .returning({ id: notes.id });
  if (trashed.length === 0) throw new NoteNotFoundError();

  await recordAuditEvent(deps, deps.requestContext, {
    action: "trash.item_trashed",
    actor: { kind: "user", userId: actor.userId },
    workspaceId: actor.workspaceId,
    target: { type: "note", id: input.noteId },
    metadata: { entityType: "note" },
  });
  return {
    type: "note",
    id: input.noteId,
    deletedAt: now.toISOString(),
    purgeAt: trashPurgeAt(now, NOTE_TRASH_RETENTION_DAYS).toISOString(),
  };
}
