import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { user } from "../accounts";
import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { type EmailService, sha256Hex } from "../platform";
import {
  type Actor,
  AlreadyMemberError,
  invitationExpiresAt,
  normalizeEmail,
  PersonalWorkspaceError,
  type Role,
  requireMode,
  requirePermission,
  type WorkspaceMode,
} from "./domain";
import {
  workspaceInvitations,
  workspaceMembers,
  workspaces,
} from "./workspaces.schema";

export interface CreatedInvitation {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly expiresAt: string;
  /** Whether the link went out by email; when not, the adapter logs it (local dev). */
  readonly delivered: boolean;
  /** The one-time link. Only the adapter sees it; it is never returned to API callers. */
  readonly link: string;
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] ?? char
  );

/**
 * Invites `email` into the actor's workspace with `role`. A random token goes into the
 * link and only its SHA-256 hash is stored. A pending invitation for the same email is
 * replaced (revoked) by the new one in the same batch. The link is mailed when email is
 * configured.
 */
export async function createInvitation(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly email: EmailService | null;
    readonly requestContext: RequestContext;
  },
  actor: Actor,
  input: {
    readonly mode: WorkspaceMode;
    readonly email: string;
    readonly role: Role;
    /** The app's origin, for the link: `<appUrl>/invite/<token>`. */
    readonly appUrl: string;
  }
): Promise<CreatedInvitation> {
  requireMode(input.mode, "members", "Inviting people");
  requirePermission(actor, "invitations.manage");
  const email = normalizeEmail(z.email().parse(input.email.trim()));

  const [context] = await deps.db
    .select({
      workspaceName: workspaces.name,
      kind: workspaces.kind,
      inviterName: user.name,
    })
    .from(workspaces)
    .innerJoin(user, eq(user.id, actor.userId))
    .where(eq(workspaces.id, actor.workspaceId));
  if (context?.kind === "personal")
    throw new PersonalWorkspaceError("Inviting people");

  const [existing] = await deps.db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .innerJoin(user, eq(user.id, workspaceMembers.userId))
    .where(
      and(
        eq(workspaceMembers.workspaceId, actor.workspaceId),
        eq(user.email, email)
      )
    )
    .limit(1);
  if (existing) throw new AlreadyMemberError();

  const now = deps.clock.now();
  const id = deps.ids.uuid();
  // Two v4 UUIDs from the platform's CSPRNG: 244 random bits in the link.
  const token = `${deps.ids.uuid()}${deps.ids.uuid()}`.replaceAll("-", "");
  const expiresAt = invitationExpiresAt(now);

  await deps.db.batch([
    deps.db
      .update(workspaceInvitations)
      .set({ revokedAt: now })
      .where(
        and(
          eq(workspaceInvitations.workspaceId, actor.workspaceId),
          eq(workspaceInvitations.email, email),
          isNull(workspaceInvitations.acceptedAt),
          isNull(workspaceInvitations.revokedAt)
        )
      ),
    deps.db.insert(workspaceInvitations).values({
      id,
      workspaceId: actor.workspaceId,
      email,
      role: input.role,
      tokenHash: await sha256Hex(token),
      invitedBy: actor.userId,
      expiresAt,
      createdAt: now,
    }),
  ]);

  await recordAuditEvent(deps, deps.requestContext, {
    action: "workspace.invitation_created",
    actor: { kind: "user", userId: actor.userId },
    workspaceId: actor.workspaceId,
    target: { type: "invitation", id },
    metadata: { email, role: input.role },
  });

  const link = `${input.appUrl.replace(/\/+$/, "")}/invite/${token}`;
  const workspaceName = context?.workspaceName ?? "a workspace";
  const inviterName = context?.inviterName || "A teammate";
  if (deps.email) {
    await deps.email.send({
      to: { email },
      subject: `${inviterName} invited you to ${workspaceName}`,
      text: `${inviterName} invited you to join ${workspaceName}. Open this link within 7 days to accept: ${link}`,
      html: `<p>${escapeHtml(inviterName)} invited you to join <strong>${escapeHtml(workspaceName)}</strong>.</p><p><a href="${escapeHtml(link)}">Accept the invitation</a> (the link works for 7 days).</p>`,
    });
  }

  return {
    id,
    email,
    role: input.role,
    expiresAt: expiresAt.toISOString(),
    delivered: deps.email !== null,
    link,
  };
}
