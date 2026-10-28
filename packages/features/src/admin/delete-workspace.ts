import { eq } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import {
  PersonalWorkspaceError,
  type WorkspaceMode,
  WorkspaceModeError,
  WorkspaceNotFoundError,
  workspaces,
} from "../workspaces";
import type { AdminActor } from "./domain";

/**
 * Deletes a shared workspace with everything in it: its files (R2 objects through
 * `purgeWorkspaceFiles`, then the rows), members and invitations. Personal workspaces go
 * with their user's account and are refused here. Not in personal mode.
 */
export async function deleteWorkspace(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly purgeWorkspaceFiles: (
      workspaceIds: readonly string[]
    ) => Promise<void>;
  },
  admin: AdminActor,
  input: { readonly workspaceId: string; readonly mode: WorkspaceMode }
): Promise<{ readonly workspaceId: string }> {
  if (input.mode === "personal") {
    throw new WorkspaceModeError(input.mode, "Deleting a workspace");
  }
  const [workspace] = await deps.db
    .select({ id: workspaces.id, kind: workspaces.kind })
    .from(workspaces)
    .where(eq(workspaces.id, input.workspaceId))
    .limit(1);
  if (!workspace) throw new WorkspaceNotFoundError();
  if (workspace.kind === "personal") {
    throw new PersonalWorkspaceError("Deleting the workspace");
  }

  await deps.purgeWorkspaceFiles([workspace.id]);
  // Members, invitations and file rows go with it (ON DELETE CASCADE).
  await deps.db.delete(workspaces).where(eq(workspaces.id, workspace.id));
  await recordAuditEvent(deps, deps.requestContext, {
    action: "workspace.deleted",
    actor: { kind: "admin", userId: admin.userId },
    workspaceId: workspace.id,
    target: { type: "workspace", id: workspace.id },
  });
  return { workspaceId: workspace.id };
}
