import { eq } from "drizzle-orm";

import { user } from "../accounts";
import type { Database } from "../database";
import type { Clock } from "../kernel";
import { sha256Hex } from "../platform";
import {
  InvitationNotFoundError,
  type InvitationStatus,
  invitationStatus,
} from "./domain";
import { workspaceInvitations, workspaces } from "./workspaces.schema";

export interface InvitationPreview {
  readonly status: InvitationStatus;
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly inviterName: string | null;
  readonly email: string;
  readonly role: string;
  readonly expiresAt: string;
}

/**
 * What an invitation link points at, for the accept page: shown to whoever holds the
 * link (the token is the secret), signed in or not. Unknown tokens are not found.
 */
export async function previewInvitation(
  deps: { readonly db: Database; readonly clock: Clock },
  input: { readonly token: string }
): Promise<InvitationPreview> {
  const [row] = await deps.db
    .select({
      invitation: workspaceInvitations,
      workspaceName: workspaces.name,
      inviterName: user.name,
    })
    .from(workspaceInvitations)
    .innerJoin(workspaces, eq(workspaces.id, workspaceInvitations.workspaceId))
    .leftJoin(user, eq(user.id, workspaceInvitations.invitedBy))
    .where(eq(workspaceInvitations.tokenHash, await sha256Hex(input.token)))
    .limit(1);
  if (!row) throw new InvitationNotFoundError();

  return {
    status: invitationStatus(row.invitation, deps.clock.now()),
    workspaceId: row.invitation.workspaceId,
    workspaceName: row.workspaceName,
    inviterName: row.inviterName,
    email: row.invitation.email,
    role: row.invitation.role,
    expiresAt: row.invitation.expiresAt.toISOString(),
  };
}
