import { and, eq } from "drizzle-orm";

import type { Database } from "../database";
import type { Clock } from "../kernel";
import { type Actor, requireMode, type WorkspaceMode } from "./domain";
import { workspaceMembers } from "./workspaces.schema";

/**
 * Multi mode: makes the actor's workspace their default, for every client (web and MCP)
 * that does not name a workspace. The actor was resolved for that workspace, so the
 * user is a member.
 */
export async function switchWorkspace(
  deps: { readonly db: Database; readonly clock: Clock },
  actor: Actor,
  input: { readonly mode: WorkspaceMode }
): Promise<{ readonly workspaceId: string }> {
  requireMode(input.mode, "switch", "Switching workspaces");
  await deps.db
    .update(workspaceMembers)
    .set({ lastActiveAt: deps.clock.now() })
    .where(
      and(
        eq(workspaceMembers.workspaceId, actor.workspaceId),
        eq(workspaceMembers.userId, actor.userId)
      )
    );
  return { workspaceId: actor.workspaceId };
}
