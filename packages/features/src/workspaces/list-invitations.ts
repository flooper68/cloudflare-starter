import { and, desc, eq, isNull } from "drizzle-orm";

import type { Database } from "../database";
import type { Clock } from "../kernel";
import {
  type Actor,
  type InvitationStatus,
  invitationStatus,
  isRole,
  type Role,
  requireMode,
  requirePermission,
  type WorkspaceMode,
} from "./domain";
import { workspaceInvitations } from "./workspaces.schema";

export interface InvitationSummary {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly status: Extract<InvitationStatus, "pending" | "expired">;
  readonly expiresAt: string;
}

/** Open invitations of the actor's workspace (pending or expired), newest first. */
export async function listInvitations(
  deps: { readonly db: Database; readonly clock: Clock },
  actor: Actor,
  input: { readonly mode: WorkspaceMode }
): Promise<readonly InvitationSummary[]> {
  requireMode(input.mode, "members", "Invitations");
  requirePermission(actor, "invitations.read");

  const rows = await deps.db
    .select()
    .from(workspaceInvitations)
    .where(
      and(
        eq(workspaceInvitations.workspaceId, actor.workspaceId),
        isNull(workspaceInvitations.acceptedAt),
        isNull(workspaceInvitations.revokedAt)
      )
    )
    .orderBy(desc(workspaceInvitations.createdAt))
    .limit(100);

  const now = deps.clock.now();
  return rows.flatMap((row) =>
    isRole(row.role)
      ? [
          {
            id: row.id,
            email: row.email,
            role: row.role,
            status:
              invitationStatus(row, now) === "expired"
                ? ("expired" as const)
                : ("pending" as const),
            expiresAt: row.expiresAt.toISOString(),
          },
        ]
      : []
  );
}
