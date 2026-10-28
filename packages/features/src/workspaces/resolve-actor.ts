import { and, desc, eq, sql } from "drizzle-orm";

import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import type { ProductAnalytics } from "../platform";
import {
  type Actor,
  CREATOR_ROLE,
  isRole,
  modeAllows,
  NotWorkspaceMemberError,
  type WorkspaceMode,
  WorkspaceNotFoundError,
} from "./domain";
import { provisionUser } from "./provision-user";
import { workspaceMembers } from "./workspaces.schema";

/**
 * The actor for a request: the user's membership in `workspaceId`, or, without one, in
 * their default workspace. The default is the only workspace in personal and single mode
 * and the most recently switched-to one in multi mode. A workspace the user is not a
 * member of is reported as not found.
 *
 * A user without any membership (their sign-up provisioning failed; it fails open) is
 * healed in personal and multi mode: their personal workspace is provisioned now, by the
 * same idempotent, audited use case. In single mode they get NotWorkspaceMemberError:
 * joining the app's workspace takes an invitation.
 */
export async function resolveActor(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    /** For the personal workspace a healed user gets (provisionUser tracks it). */
    readonly analytics: ProductAnalytics;
  },
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

  if (!membership && !input.workspaceId) {
    if (!modeAllows(input.mode, "personalWorkspace"))
      throw new NotWorkspaceMemberError();
    const healed = await provisionUser(deps, {
      // Only the mode and the user id are read for a personal workspace.
      user: { id: input.userId, email: "" },
      settings: {
        mode: input.mode,
        signUp: "invite",
        signUpDomains: [],
        bootstrapAdminEmail: null,
      },
      sharedWorkspaceName: "",
    });
    return {
      userId: input.userId,
      workspaceId: healed.workspaceId ?? "",
      role: healed.role ?? CREATOR_ROLE,
    };
  }
  if (!membership || !isRole(membership.role))
    throw new WorkspaceNotFoundError();
  return {
    userId: input.userId,
    workspaceId: membership.workspaceId,
    role: membership.role,
  };
}
