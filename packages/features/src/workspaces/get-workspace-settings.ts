import { eq } from "drizzle-orm";
import type { Database } from "../database";
import {
  type Actor,
  can,
  requirePermission,
  WorkspaceNotFoundError,
} from "./domain";
import { workspaces } from "./workspaces.schema";

/** Workspace settings are visible to its members; mutation permissions are separate. */
export async function getWorkspaceSettings(
  deps: { readonly db: Database },
  actor: Actor
) {
  requirePermission(actor, "members.read");
  const [row] = await deps.db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, actor.workspaceId));
  if (!row) throw new WorkspaceNotFoundError();
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    canManage: can(actor.role, "workspace.manage"),
    canDelete: can(actor.role, "workspace.delete"),
    logoUrl: row.logoKey
      ? `/api/workspaces/${encodeURIComponent(row.id)}/logo/${encodeURIComponent(row.logoKey.split("/").at(-1) ?? "")}`
      : null,
  };
}
