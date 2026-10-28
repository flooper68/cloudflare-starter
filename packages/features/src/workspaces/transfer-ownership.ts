import { and, eq } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import {
  type Actor,
  CREATOR_ROLE,
  DEFAULT_MEMBER_ROLE,
  MemberNotFoundError,
  requireMode,
  requirePermission,
  TransferToSelfError,
  type WorkspaceMode,
} from "./domain";
import { workspaceMembers } from "./workspaces.schema";

/** Makes another member the owner and the actor a member, in one batch. */
export async function transferOwnership(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  actor: Actor,
  input: { readonly mode: WorkspaceMode; readonly userId: string }
): Promise<{ readonly ownerUserId: string }> {
  requireMode(input.mode, "members", "Transferring ownership");
  requirePermission(actor, "ownership.transfer");
  if (input.userId === actor.userId) throw new TransferToSelfError();

  const target = await deps.db.query.workspaceMembers.findFirst({
    columns: { userId: true },
    where: and(
      eq(workspaceMembers.workspaceId, actor.workspaceId),
      eq(workspaceMembers.userId, input.userId)
    ),
  });
  if (!target) throw new MemberNotFoundError();

  const setRole = (userId: string, role: typeof CREATOR_ROLE) =>
    deps.db
      .update(workspaceMembers)
      .set({ role })
      .where(
        and(
          eq(workspaceMembers.workspaceId, actor.workspaceId),
          eq(workspaceMembers.userId, userId)
        )
      );
  await deps.db.batch([
    setRole(input.userId, CREATOR_ROLE),
    setRole(actor.userId, DEFAULT_MEMBER_ROLE),
  ]);
  await recordAuditEvent(deps, deps.requestContext, {
    action: "workspace.ownership_transferred",
    actor: { kind: "user", userId: actor.userId },
    workspaceId: actor.workspaceId,
    target: { type: "workspace", id: actor.workspaceId },
    metadata: { previousOwnerUserId: actor.userId, ownerUserId: input.userId },
  });
  return { ownerUserId: input.userId };
}
