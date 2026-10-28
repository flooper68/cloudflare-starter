import { and, eq, isNull } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import {
  type Actor,
  InvitationNotFoundError,
  requireMode,
  requirePermission,
  type WorkspaceMode,
} from "./domain";
import { workspaceInvitations } from "./workspaces.schema";

/** Revokes an open invitation of the actor's workspace; its link stops working. */
export async function revokeInvitation(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  actor: Actor,
  input: { readonly mode: WorkspaceMode; readonly invitationId: string }
): Promise<{ readonly revoked: true }> {
  requireMode(input.mode, "members", "Revoking invitations");
  requirePermission(actor, "invitations.manage");

  const revoked = await deps.db
    .update(workspaceInvitations)
    .set({ revokedAt: deps.clock.now() })
    .where(
      and(
        eq(workspaceInvitations.id, input.invitationId),
        eq(workspaceInvitations.workspaceId, actor.workspaceId),
        isNull(workspaceInvitations.acceptedAt),
        isNull(workspaceInvitations.revokedAt)
      )
    )
    .returning({ id: workspaceInvitations.id });
  if (revoked.length === 0) throw new InvitationNotFoundError();
  await recordAuditEvent(deps, deps.requestContext, {
    action: "workspace.invitation_revoked",
    actor: { kind: "user", userId: actor.userId },
    workspaceId: actor.workspaceId,
    target: { type: "invitation", id: input.invitationId },
  });
  return { revoked: true };
}
