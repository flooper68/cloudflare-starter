import { eq } from "drizzle-orm";
import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import {
  type Clock,
  DomainError,
  type Ids,
  type RequestContext,
} from "../kernel";
import { type Actor, requirePermission, type WorkspaceMode } from "./domain";
import { getWorkspaceSettings } from "./get-workspace-settings";
import { workspaces } from "./workspaces.schema";

/** Explicit confirmation and multi/shared-only deletion, with injected storage cleanup. */
export async function deleteOwnWorkspace(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly purgeWorkspaceFiles: (ids: readonly string[]) => Promise<void>;
  },
  actor: Actor,
  input: { readonly mode: WorkspaceMode; readonly confirmName: string }
) {
  requirePermission(actor, "workspace.delete");
  const workspace = await getWorkspaceSettings(deps, actor);
  if (input.mode !== "multi" || workspace.kind !== "shared")
    throw new DomainError(
      "forbidden",
      "Only shared workspaces in multi mode can be deleted",
      "WORKSPACE_DELETE_REFUSED"
    );
  if (input.confirmName !== workspace.name)
    throw new DomainError(
      "invalid_input",
      "Type the workspace name to confirm",
      "CONFIRMATION_MISMATCH"
    );
  await deps.purgeWorkspaceFiles([actor.workspaceId]);
  await deps.db.delete(workspaces).where(eq(workspaces.id, actor.workspaceId));
  await recordAuditEvent(deps, deps.requestContext, {
    action: "workspace.deleted",
    workspaceId: actor.workspaceId,
    target: { type: "workspace", id: actor.workspaceId },
  });
  return { deleted: true };
}
