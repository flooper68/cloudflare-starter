import { and, desc, eq, sql } from "drizzle-orm";

import type { Database } from "../database";
import {
  type Actor,
  isRole,
  type WorkspaceMode,
  WorkspaceNotFoundError,
} from "./domain";
import { workspaceMembers } from "./workspaces.schema";

/**
 * The actor for a request: the user's membership in `workspaceId`, or, without one, in
 * their default workspace. The default is the only workspace in personal and single mode
 * and the most recently switched-to one in multi mode. A workspace the user is not a
 * member of is reported as not found.
 */
export async function resolveActor(
  deps: { readonly db: Database },
  input: {
    readonly userId: string;
    readonly mode: WorkspaceMode;
    readonly workspaceId?: string;
  }
): Promise<Actor> {
  const [membership] = await deps.db
    .select({
      workspaceId: workspaceMembers.workspaceId,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .where(
      input.workspaceId
        ? and(
            eq(workspaceMembers.userId, input.userId),
            eq(workspaceMembers.workspaceId, input.workspaceId)
          )
        : eq(workspaceMembers.userId, input.userId)
    )
    .orderBy(
      sql`${workspaceMembers.lastActiveAt} desc nulls last`,
      desc(workspaceMembers.createdAt)
    )
    .limit(1);

  if (!membership || !isRole(membership.role))
    throw new WorkspaceNotFoundError();
  return {
    userId: input.userId,
    workspaceId: membership.workspaceId,
    role: membership.role,
  };
}
