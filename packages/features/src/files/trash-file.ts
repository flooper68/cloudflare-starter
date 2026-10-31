import { and, eq } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { liveIn, trashPurgeAt } from "../trash";
import { type Actor, requirePermission } from "../workspaces";
import { FILE_TRASH_RETENTION_DAYS, FileNotFoundError } from "./domain";
import { files } from "./files.schema";

/**
 * Moves a live file of the actor's workspace to its trash (`files.delete`): it leaves the
 * file list and downloads at once, and the object stays in R2 until it is restored or
 * purged (after FILE_TRASH_RETENTION_DAYS). Records `trash.item_trashed`.
 */
export async function trashFile(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  actor: Actor,
  input: { readonly fileId: string }
): Promise<{
  readonly type: "file";
  readonly id: string;
  readonly deletedAt: string;
  readonly purgeAt: string;
}> {
  requirePermission(actor, "files.delete");
  const now = deps.clock.now();
  const trashed = await deps.db
    .update(files)
    .set({ deletedAt: now, deletedBy: actor.userId })
    .where(and(eq(files.id, input.fileId), liveIn(files, actor)))
    .returning({ id: files.id });
  if (trashed.length === 0) throw new FileNotFoundError();

  await recordAuditEvent(deps, deps.requestContext, {
    action: "trash.item_trashed",
    actor: { kind: "user", userId: actor.userId },
    workspaceId: actor.workspaceId,
    target: { type: "file", id: input.fileId },
    metadata: { entityType: "file" },
  });
  return {
    type: "file",
    id: input.fileId,
    deletedAt: now.toISOString(),
    purgeAt: trashPurgeAt(now, FILE_TRASH_RETENTION_DAYS).toISOString(),
  };
}
