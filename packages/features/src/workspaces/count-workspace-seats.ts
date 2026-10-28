import { and, count, eq, gt, isNull } from "drizzle-orm";

import type { Database } from "../database";
import type { Clock } from "../kernel";
import { workspaceInvitations, workspaceMembers } from "./workspaces.schema";

/**
 * Seats a workspace uses: its members plus its pending (not accepted, revoked or expired)
 * invitations, so inviting cannot get around the limit. The `seats` metric of the billing
 * catalog (source `workspaces.countWorkspaceSeats`); billing calls it for a workspace its
 * caller has already authorized.
 */
export async function countWorkspaceSeats(
  deps: { readonly db: Database; readonly clock: Clock },
  input: { readonly workspaceId: string }
): Promise<number> {
  const [[members], [pending]] = await deps.db.batch([
    deps.db
      .select({ n: count() })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, input.workspaceId)),
    deps.db
      .select({ n: count() })
      .from(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.workspaceId, input.workspaceId),
          isNull(workspaceInvitations.acceptedAt),
          isNull(workspaceInvitations.revokedAt),
          gt(workspaceInvitations.expiresAt, deps.clock.now())
        )
      ),
  ]);
  return (members?.n ?? 0) + (pending?.n ?? 0);
}
