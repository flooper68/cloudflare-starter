import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";

import { user } from "../accounts";
import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type {
  BillingGate,
  Clock,
  Ids,
  Notify,
  RequestContext,
} from "../kernel";
import { type ProductAnalytics, sha256Hex } from "../platform";
import { trackEvent } from "../product-analytics";
import {
  InvitationExpiredError,
  InvitationNotFoundError,
  InvitationWrongAccountError,
  invitationStatus,
  isRole,
  memberJoinedEvent,
  memberJoinedNotification,
  normalizeEmail,
  requireMode,
  rolesAllowedTo,
  type WorkspaceMode,
} from "./domain";
import { identifyMember } from "./identify-member";
import {
  workspaceInvitations,
  workspaceMembers,
  workspaces,
} from "./workspaces.schema";

/**
 * The signed-in user accepts the invitation behind `token`: it must be pending and sent
 * to their email. Using it up and adding the membership happen in one batch, and the
 * update only matches while `accepted_at IS NULL`, so a link works once even under
 * concurrent clicks. The workspace becomes the user's active one. Accepting again as the
 * same member succeeds without changes. The members who can manage members get a
 * `workspaces.member-joined` notification.
 */
export async function acceptInvitation(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly notify: Notify;
    readonly analytics: ProductAnalytics;
    /** The joined workspace's plan, for the analytics traits. */
    readonly billing: BillingGate;
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

  const [managers, [workspace], [member]] = await Promise.all([
    deps.db
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, invitation.workspaceId),
          inArray(workspaceMembers.role, [...rolesAllowedTo("members.manage")])
        )
      )
      .limit(500),
    deps.db
      .select({ name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, invitation.workspaceId)),
    deps.db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, input.user.id)),
  ]);
  await deps.notify(memberJoinedNotification, {
    recipients: managers.map((manager) => manager.userId),
    data: {
      workspaceId: invitation.workspaceId,
      workspaceName: workspace?.name ?? "your workspace",
      // User names have no length limit; the notification's data does.
      memberName: (member?.name || input.user.email).slice(0, 200),
      role: invitation.role,
    },
    context: {
      workspaceId: invitation.workspaceId,
      requestContext: { ...deps.requestContext, userId: input.user.id },
    },
  });
  if (isRole(invitation.role)) {
    const actor = {
      userId: input.user.id,
      workspaceId: invitation.workspaceId,
      role: invitation.role,
    };
    trackEvent(deps, { ...deps.requestContext, ...actor }, memberJoinedEvent, {
      role: invitation.role,
      via: "invitation",
    });
    await identifyMember(deps, actor);
  }
  return { workspaceId: invitation.workspaceId };
}
