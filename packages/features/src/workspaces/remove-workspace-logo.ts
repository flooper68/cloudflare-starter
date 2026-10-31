import { eq } from "drizzle-orm";
import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { type Actor, requirePermission } from "./domain";
import { workspaces } from "./workspaces.schema";

/** Unpublish the custom logo; superseded versions are reconciled later. */
export async function removeWorkspaceLogo(
  deps: {
    readonly db: Database;
    readonly bucket: R2Bucket;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  actor: Actor
) {
  requirePermission(actor, "workspace.manage");
  const [previous] = await deps.db
    .select({ key: workspaces.logoKey })
    .from(workspaces)
    .where(eq(workspaces.id, actor.workspaceId));
  await deps.db
    .update(workspaces)
    .set({ logoKey: null })
    .where(eq(workspaces.id, actor.workspaceId));
  await recordAuditEvent(deps, deps.requestContext, {
    action: "workspace.logo_removed",
    workspaceId: actor.workspaceId,
    target: { type: "workspace", id: actor.workspaceId },
  });
  if (previous?.key) await deps.bucket.delete(previous.key);
  return { removed: true };
}
