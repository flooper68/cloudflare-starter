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
  type Role,
  requireManagerRemains,
  requireMode,
  requirePermission,
  rolesAllowedTo,
  type WorkspaceMode,
} from "./domain";
import { workspaceMembers } from "./workspaces.schema";

/** Gives a member another role; never leaves the workspace without a manager. */
export async function changeMemberRole(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  actor: Actor,
  input: {
    readonly mode: WorkspaceMode;
    readonly userId: string;
    readonly role: Role;
  }
): Promise<{ readonly userId: string; readonly role: Role }> {
  requireMode(input.mode, "members", "Changing roles");
  requirePermission(actor, "members.manage");

  const members: MemberRole[] = (
    await deps.db
      .select({ userId: workspaceMembers.userId, role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, actor.workspaceId))
  ).flatMap((row) => (isRole(row.role) ? [{ ...row, role: row.role }] : []));

  const target = members.find((member) => member.userId === input.userId);
  if (!target) throw new MemberNotFoundError();
  requireManagerRemains(members, {
    userId: input.userId,
    nextRole: input.role,
  });

  // A demotion is checked again in the write, so two owners demoting each other at once
  // cannot leave the workspace without one.
  const demotesManager =
    can(target.role, "members.manage") && !can(input.role, "members.manage");
  const managers = rolesAllowedTo("members.manage");
  const changed = await deps.db
    .update(workspaceMembers)
    .set({ role: input.role })
    .where(
      and(
        eq(workspaceMembers.workspaceId, actor.workspaceId),
        eq(workspaceMembers.userId, input.userId),
        demotesManager
          ? sql`exists (select 1 from workspace_members other where other.workspace_id = ${actor.workspaceId} and other.user_id <> ${input.userId} and other.role in (${sql.join(
              managers.map((role) => sql`${role}`),
              sql`, `
            )}))`
          : undefined
      )
    )
    .returning({ userId: workspaceMembers.userId });
  if (changed.length === 0) throw new LastOwnerError();
  await recordAuditEvent(deps, deps.requestContext, {
    action: "workspace.member_role_changed",
    actor: { kind: "user", userId: actor.userId },
    workspaceId: actor.workspaceId,
    target: { type: "user", id: input.userId },
    metadata: { previousRole: target.role, role: input.role },
  });
  return { userId: input.userId, role: input.role };
}
