import { and, eq, sql } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import {
  type Actor,
  can,
  isRole,
  LastOwnerError,
  MemberNotFoundError,
  type MemberRole,
  requireManagerRemains,
  requireMode,
  requirePermission,
  rolesAllowedTo,
  type WorkspaceMode,
} from "./domain";
import { workspaceMembers } from "./workspaces.schema";

/** Removes a member from the actor's workspace; never the last one who can manage it. */
export async function removeMember(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  actor: Actor,
  input: { readonly mode: WorkspaceMode; readonly userId: string }
): Promise<{ readonly removed: true }> {
  requireMode(input.mode, "members", "Removing members");
  requirePermission(actor, "members.manage");

  const members: MemberRole[] = (
    await deps.db
      .select({ userId: workspaceMembers.userId, role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, actor.workspaceId))
  ).flatMap((row) => (isRole(row.role) ? [{ ...row, role: row.role }] : []));

  const target = members.find((member) => member.userId === input.userId);
  if (!target) throw new MemberNotFoundError();
  requireManagerRemains(members, { userId: input.userId, nextRole: null });

  // Checked again in the write: two owners removing each other at once must not both win.
  const managers = rolesAllowedTo("members.manage");
  const removed = await deps.db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, actor.workspaceId),
        eq(workspaceMembers.userId, input.userId),
        can(target.role, "members.manage")
          ? sql`exists (select 1 from workspace_members other where other.workspace_id = ${actor.workspaceId} and other.user_id <> ${input.userId} and other.role in (${sql.join(
              managers.map((role) => sql`${role}`),
              sql`, `
            )}))`
          : undefined
      )
    )
    .returning({ userId: workspaceMembers.userId });
  if (removed.length === 0) throw new LastOwnerError();
  await recordAuditEvent(deps, deps.requestContext, {
    action: "workspace.member_removed",
    actor: { kind: "user", userId: actor.userId },
    workspaceId: actor.workspaceId,
    target: { type: "user", id: input.userId },
    metadata: { role: target.role },
  });
  return { removed: true };
}
