import { asc, eq } from "drizzle-orm";

import { user } from "../accounts";
import type { Database } from "../database";
import {
  type Actor,
  isRole,
  type Role,
  requireMode,
  requirePermission,
  type WorkspaceMode,
} from "./domain";
import { workspaceMembers } from "./workspaces.schema";

export interface WorkspaceMember {
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly role: Role;
  readonly joinedAt: string;
}

/** The members of the actor's workspace, oldest first. */
export async function listMembers(
  deps: { readonly db: Database },
  actor: Actor,
  input: { readonly mode: WorkspaceMode }
): Promise<readonly WorkspaceMember[]> {
  requireMode(input.mode, "members", "Members");
  requirePermission(actor, "members.read");

  const rows = await deps.db
    .select({
      userId: workspaceMembers.userId,
      name: user.name,
      email: user.email,
      role: workspaceMembers.role,
      createdAt: workspaceMembers.createdAt,
    })
    .from(workspaceMembers)
    .innerJoin(user, eq(user.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, actor.workspaceId))
    .orderBy(asc(workspaceMembers.createdAt));

  return rows.flatMap((row) =>
    isRole(row.role)
      ? [
          {
            userId: row.userId,
            name: row.name,
            email: row.email,
            role: row.role,
            joinedAt: row.createdAt.toISOString(),
          },
        ]
      : []
  );
}
