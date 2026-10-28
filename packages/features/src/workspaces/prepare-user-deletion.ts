import { and, eq, inArray } from "drizzle-orm";

import { type AuditActor, recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { isRole, type MemberRole, requireManagerRemains } from "./domain";
import { workspaceMembers, workspaces } from "./workspaces.schema";

/**
 * Before a user is deleted (Better Auth's `user.delete.before` hook): their personal
 * workspace, and any shared workspace where they are the only member, is deleted with its
 * data; they leave every other workspace. Refuses with LastOwnerError, before changing
 * anything, if they are the last member able to manage a workspace others still use.
 *
 * Objects in R2 are not rows: `purgeWorkspaceFiles` (the files feature's
 * `deleteWorkspaceFiles`, wired by the adapter) removes them before the rows go.
 */
export async function prepareUserDeletion(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly purgeWorkspaceFiles: (
      workspaceIds: readonly string[]
    ) => Promise<void>;
  },
  input: {
    readonly userId: string;
    /** Who deletes the account: the user by default, an admin from the admin portal. */
    readonly actor?: AuditActor;
  }
): Promise<{
  readonly deletedWorkspaceIds: readonly string[];
  readonly leftWorkspaceIds: readonly string[];
}> {
  const memberships = await deps.db
    .select({
      workspaceId: workspaceMembers.workspaceId,
      kind: workspaces.kind,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, input.userId));

  const sharedIds = memberships
    .filter((membership) => membership.kind === "shared")
    .map((membership) => membership.workspaceId);
  const coMembers = sharedIds.length
    ? await deps.db
        .select({
          workspaceId: workspaceMembers.workspaceId,
          userId: workspaceMembers.userId,
          role: workspaceMembers.role,
        })
        .from(workspaceMembers)
        .where(inArray(workspaceMembers.workspaceId, sharedIds))
    : [];

  const deleted: string[] = [];
  const left: string[] = [];
  for (const membership of memberships) {
    if (membership.kind === "personal") {
      deleted.push(membership.workspaceId);
      continue;
    }
    const members: MemberRole[] = coMembers.flatMap((member) =>
      member.workspaceId === membership.workspaceId && isRole(member.role)
        ? [{ userId: member.userId, role: member.role }]
        : []
    );
    if (members.every((member) => member.userId === input.userId)) {
      deleted.push(membership.workspaceId);
      continue;
    }
    requireManagerRemains(members, { userId: input.userId, nextRole: null });
    left.push(membership.workspaceId);
  }

  if (deleted.length) await deps.purgeWorkspaceFiles(deleted);
  const statements = [
    ...(deleted.length
      ? [deps.db.delete(workspaces).where(inArray(workspaces.id, deleted))]
      : []),
    ...(left.length
      ? [
          deps.db
            .delete(workspaceMembers)
            .where(
              and(
                eq(workspaceMembers.userId, input.userId),
                inArray(workspaceMembers.workspaceId, left)
              )
            ),
        ]
      : []),
  ];
  const [first, ...rest] = statements;
  if (first) await deps.db.batch([first, ...rest]);

  const actor = input.actor ?? { kind: "user" as const, userId: input.userId };
  for (const workspaceId of deleted) {
    await recordAuditEvent(deps, deps.requestContext, {
      action: "workspace.deleted",
      actor,
      workspaceId,
      target: { type: "workspace", id: workspaceId },
    });
  }
  for (const workspaceId of left) {
    await recordAuditEvent(deps, deps.requestContext, {
      action: "workspace.member_left",
      actor,
      workspaceId,
      target: { type: "user", id: input.userId },
    });
  }
  return { deletedWorkspaceIds: deleted, leftWorkspaceIds: left };
}
