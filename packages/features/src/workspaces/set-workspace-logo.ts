import { eq } from "drizzle-orm";
import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import {
  type Clock,
  type Ids,
  profileImageType,
  type RequestContext,
} from "../kernel";
import { type Actor, requirePermission } from "./domain";
import { getWorkspaceSettings } from "./get-workspace-settings";
import { workspaces } from "./workspaces.schema";

/** Upload first, then publish the reference; superseded versions are reconciled later. */
export async function setWorkspaceLogo(
  deps: {
    readonly db: Database;
    readonly bucket: R2Bucket;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  actor: Actor,
  input: { readonly bytes: Uint8Array; readonly contentType: string }
) {
  requirePermission(actor, "workspace.manage");
  await getWorkspaceSettings(deps, actor);
  const [previous] = await deps.db
    .select({ key: workspaces.logoKey })
    .from(workspaces)
    .where(eq(workspaces.id, actor.workspaceId));
  const contentType = profileImageType(input.bytes, input.contentType);
  const key = `workspaces/${actor.workspaceId}/logo/${deps.ids.uuid()}`;
  await deps.bucket.put(key, input.bytes, { httpMetadata: { contentType } });
  await deps.db
    .update(workspaces)
    .set({ logoKey: key })
    .where(eq(workspaces.id, actor.workspaceId));
  await recordAuditEvent(deps, deps.requestContext, {
    action: "workspace.logo_updated",
    workspaceId: actor.workspaceId,
    target: { type: "workspace", id: actor.workspaceId },
  });
  if (previous?.key) await deps.bucket.delete(previous.key);
  return getWorkspaceSettings(deps, actor);
}
