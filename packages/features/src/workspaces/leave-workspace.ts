import { and, eq, sql } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import {
  type Actor,
  can,
  isRole,
  LastOwnerError,
  type MemberRole,
  PersonalWorkspaceError,
  requireManagerRemains,
  requireMode,
  rolesAllowedTo,
  type WorkspaceMode,
} from "./domain";
import { workspaceMembers, workspaces } from "./workspaces.schema";

/** The actor leaves their workspace; the last one who can manage it must hand over first. */
export async function leaveWorkspace(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  actor: Actor,
  input: { readonly mode: WorkspaceMode }
): Promise<{ readonly left: true }> {
  requireMode(input.mode, "members", "Leaving a workspace");

  const workspace = await deps.db.query.workspaces.findFirst({
    columns: { kind: true },
    where: eq(workspaces.id, actor.workspaceId),
  });
  if (workspace?.kind === "personal")
    throw new PersonalWorkspaceError("Leaving");

  const members: MemberRole[] = (
    await deps.db
      .select({ userId: workspaceMembers.userId, role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, actor.workspaceId))
  ).flatMap((row) => (isRole(row.role) ? [{ ...row, role: row.role }] : []));
  requireManagerRemains(members, { userId: actor.userId, nextRole: null });

  // Checked again in the write: two owners leaving at once must not both succeed.
  const managers = rolesAllowedTo("members.manage");
  const left = await deps.db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, actor.workspaceId),
        eq(workspaceMembers.userId, actor.userId),
        can(actor.role, "members.manage")
          ? sql`exists (select 1 from workspace_members other where other.workspace_id = ${actor.workspaceId} and other.user_id <> ${actor.userId} and other.role in (${sql.join(
              managers.map((role) => sql`${role}`),
              sql`, `
            )}))`
          : undefined
      )
    )
    .returning({ userId: workspaceMembers.userId });
  if (left.length === 0) throw new LastOwnerError();
  await recordAuditEvent(deps, deps.requestContext, {
    action: "workspace.member_left",
    actor: { kind: "user", userId: actor.userId },
    workspaceId: actor.workspaceId,
    target: { type: "user", id: actor.userId },
    metadata: { role: actor.role },
  });
  return { left: true };
}
