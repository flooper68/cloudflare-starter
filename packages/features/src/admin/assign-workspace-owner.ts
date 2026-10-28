import { eq } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import {
  CREATOR_ROLE,
  can,
  isRole,
  type WorkspaceMode,
  WorkspaceModeError,
  WorkspaceNotFoundError,
  workspaceMembers,
  workspaces,
} from "../workspaces";
import { type AdminActor, WorkspaceHasOwnerError } from "./domain";
import { findTargetUser } from "./lookups";

/**
 * Rescues a workspace left without anyone who can manage its members (its owners were
 * deleted or suspended for good): makes a user its owner, joining them if they are not a
 * member yet. Refused while the workspace has an owner; owners transfer ownership
 * themselves. Not in personal mode.
 */
export async function assignWorkspaceOwner(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  admin: AdminActor,
  input: {
    readonly workspaceId: string;
    readonly userId: string;
    readonly mode: WorkspaceMode;
  }
): Promise<{ readonly workspaceId: string; readonly userId: string }> {
  if (input.mode === "personal") {
    throw new WorkspaceModeError(input.mode, "Assigning a workspace owner");
  }
  const [workspace] = await deps.db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.id, input.workspaceId))
    .limit(1);
  if (!workspace) throw new WorkspaceNotFoundError();
  const target = await findTargetUser(deps.db, input.userId);

  const members = await deps.db
    .select({ userId: workspaceMembers.userId, role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspace.id));
  if (
    members.some(
      (member) => isRole(member.role) && can(member.role, "members.manage")
    )
  ) {
    throw new WorkspaceHasOwnerError();
  }
  const previousRole =
    members.find((member) => member.userId === target.id)?.role ?? null;

  await deps.db
    .insert(workspaceMembers)
    .values({
      workspaceId: workspace.id,
      userId: target.id,
      role: CREATOR_ROLE,
    })
    .onConflictDoUpdate({
      target: [workspaceMembers.workspaceId, workspaceMembers.userId],
      set: { role: CREATOR_ROLE },
    });
  await recordAuditEvent(deps, deps.requestContext, {
    action: "workspace.owner_assigned",
    actor: { kind: "admin", userId: admin.userId },
    workspaceId: workspace.id,
    target: { type: "user", id: target.id },
    metadata: { previousRole },
  });
  return { workspaceId: workspace.id, userId: target.id };
}
