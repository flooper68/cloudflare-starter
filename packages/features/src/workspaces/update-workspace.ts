import { eq } from "drizzle-orm";
import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { type Actor, requirePermission, workspaceNameSchema } from "./domain";
import { getWorkspaceSettings } from "./get-workspace-settings";
import { workspaces } from "./workspaces.schema";

/** Rename the actor's workspace; an arbitrary workspace id never reaches this use case. */
export async function updateWorkspace(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  actor: Actor,
  input: { readonly name: string }
) {
  requirePermission(actor, "workspace.manage");
  await getWorkspaceSettings(deps, actor);
  const name = workspaceNameSchema.parse(input.name);
  await deps.db
    .update(workspaces)
    .set({ name })
    .where(eq(workspaces.id, actor.workspaceId));
  await recordAuditEvent(deps, deps.requestContext, {
    action: "workspace.updated",
    workspaceId: actor.workspaceId,
    target: { type: "workspace", id: actor.workspaceId },
  });
  return getWorkspaceSettings(deps, actor);
}
