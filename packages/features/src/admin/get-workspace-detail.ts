import { and, count, eq, gt, isNull } from "drizzle-orm";

import { user } from "../accounts";
import type { Database } from "../database";
import type { Clock } from "../kernel";
import {
  can,
  isRole,
  type WorkspaceMode,
  WorkspaceModeError,
  WorkspaceNotFoundError,
  workspaceInvitations,
  workspaceMembers,
  workspaces,
} from "../workspaces";
import type { AdminActor } from "./domain";

export interface AdminWorkspaceDetail {
  readonly id: string;
  readonly name: string;
  readonly kind: "personal" | "shared";
  readonly createdAt: Date;
  readonly createdBy: string | null;
  readonly members: readonly {
    readonly userId: string;
    readonly name: string;
    readonly email: string;
    readonly role: string;
    readonly joinedAt: Date;
  }[];
  /** Members whose role may manage members; 0 means it needs a new owner. */
  readonly managerCount: number;
  readonly pendingInvitations: number;
}

/** One workspace with its members and open invitations, for the admin portal. */
export async function getWorkspaceDetail(
  deps: { readonly db: Database; readonly clock: Clock },
  _admin: AdminActor,
  input: { readonly workspaceId: string; readonly mode: WorkspaceMode }
): Promise<AdminWorkspaceDetail> {
  if (input.mode === "personal") {
    throw new WorkspaceModeError(input.mode, "Administering workspaces");
  }
  const [workspace] = await deps.db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, input.workspaceId))
    .limit(1);
  if (!workspace) throw new WorkspaceNotFoundError();

  const [members, invitations] = await Promise.all([
    deps.db
      .select({
        userId: workspaceMembers.userId,
        name: user.name,
        email: user.email,
        role: workspaceMembers.role,
        joinedAt: workspaceMembers.createdAt,
      })
      .from(workspaceMembers)
      .innerJoin(user, eq(user.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, workspace.id))
      .orderBy(workspaceMembers.createdAt),
    deps.db
      .select({ value: count() })
      .from(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.workspaceId, workspace.id),
          isNull(workspaceInvitations.acceptedAt),
          isNull(workspaceInvitations.revokedAt),
          gt(workspaceInvitations.expiresAt, deps.clock.now())
        )
      ),
  ]);

  return {
    id: workspace.id,
    name: workspace.name,
    kind: workspace.kind,
    createdAt: workspace.createdAt,
    createdBy: workspace.createdBy ?? null,
    members,
    managerCount: members.filter(
      (member) => isRole(member.role) && can(member.role, "members.manage")
    ).length,
    pendingInvitations: invitations[0]?.value ?? 0,
  };
}
