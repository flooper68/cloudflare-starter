import { and, eq, gt, isNull, sql } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { sha256Hex } from "../platform";
import {
  InvitationExpiredError,
  InvitationNotFoundError,
  InvitationWrongAccountError,
  invitationStatus,
  normalizeEmail,
  requireMode,
  type WorkspaceMode,
} from "./domain";
import { workspaceInvitations, workspaceMembers } from "./workspaces.schema";

/**
 * The signed-in user accepts the invitation behind `token`: it must be pending and sent
 * to their email. Using it up and adding the membership happen in one batch, and the
 * update only matches while `accepted_at IS NULL`, so a link works once even under
 * concurrent clicks. The workspace becomes the user's active one. Accepting again as the
 * same member succeeds without changes.
 */
export async function acceptInvitation(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  input: {
    readonly mode: WorkspaceMode;
    readonly token: string;
    readonly user: { readonly id: string; readonly email: string };
  }
): Promise<{ readonly workspaceId: string }> {
  requireMode(input.mode, "members", "Accepting invitations");
  const tokenHash = await sha256Hex(input.token);
  const invitation = await deps.db.query.workspaceInvitations.findFirst({
    where: eq(workspaceInvitations.tokenHash, tokenHash),
  });
  if (!invitation) throw new InvitationNotFoundError();
  if (normalizeEmail(input.user.email) !== invitation.email)
    throw new InvitationWrongAccountError();

  const now = deps.clock.now();
  const status = invitationStatus(invitation, now);
  if (status === "accepted") {
    const member = await deps.db.query.workspaceMembers.findFirst({
      columns: { userId: true },
      where: and(
        eq(workspaceMembers.workspaceId, invitation.workspaceId),
        eq(workspaceMembers.userId, input.user.id)
      ),
    });
    if (member) return { workspaceId: invitation.workspaceId };
    throw new InvitationNotFoundError();
  }
  if (status === "revoked") throw new InvitationNotFoundError();
  if (status === "expired") throw new InvitationExpiredError();

  const [used] = await deps.db.batch([
    deps.db
      .update(workspaceInvitations)
      .set({ acceptedAt: now })
      .where(
        and(
          eq(workspaceInvitations.id, invitation.id),
          isNull(workspaceInvitations.acceptedAt),
          isNull(workspaceInvitations.revokedAt),
          gt(workspaceInvitations.expiresAt, now)
        )
      )
      .returning({ id: workspaceInvitations.id }),
    // Joins only through the row this batch just used up (accepted_at = now).
    deps.db
      .insert(workspaceMembers)
      .select(
        deps.db
          .select({
            workspaceId: workspaceInvitations.workspaceId,
            userId: sql<string>`${input.user.id}`.as("user_id"),
            role: workspaceInvitations.role,
            createdAt: sql<Date>`${now.getTime()}`.as("created_at"),
            lastActiveAt: sql<Date>`${now.getTime()}`.as("last_active_at"),
          })
          .from(workspaceInvitations)
          .where(
            and(
              eq(workspaceInvitations.id, invitation.id),
              eq(workspaceInvitations.acceptedAt, now)
            )
          )
      )
      .onConflictDoUpdate({
        target: [workspaceMembers.workspaceId, workspaceMembers.userId],
        set: { lastActiveAt: now },
      }),
  ]);
  if (used.length === 0) throw new InvitationNotFoundError();
  await recordAuditEvent(deps, deps.requestContext, {
    action: "workspace.invitation_accepted",
    actor: { kind: "user", userId: input.user.id },
    workspaceId: invitation.workspaceId,
    target: { type: "invitation", id: invitation.id },
    metadata: { role: invitation.role },
  });
  return { workspaceId: invitation.workspaceId };
}
