import { and, eq, sql } from "drizzle-orm";
import { user } from "../accounts";
import { assertUserErasureAllowed } from "../admin";
import type { AuditActor } from "../audit";
import type { Database } from "../database";
import {
  type Clock,
  DomainError,
  type Ids,
  type RequestContext,
} from "../kernel";
import { prepareUserDeletion } from "../workspaces";
import { erasureLock, erasureRecords } from "./privacy.schema";
/** Runs from BOTH Better Auth beforeDelete and database delete.before, before credentials/data vanish. */
export async function prepareUserErasure(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly eraseUserArtifacts: (input: {
      userId: string;
      email: string;
    }) => Promise<void>;
    readonly eraseWorkspaceArtifacts: (
      ids: readonly string[],
      userId: string
    ) => Promise<void>;
  },
  input: {
    readonly userId: string;
    readonly actor?: AuditActor;
    readonly operationId?: string;
  }
) {
  const [person] = await deps.db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, input.userId));
  if (!person) return { deletedWorkspaceIds: [], leftWorkspaceIds: [] };
  const now = deps.clock.now();
  const operationId = input.operationId ?? deps.ids.uuid();
  // Reentrant only for this server-owned invocation, not merely the same subject.
  const lock = await deps.db
    .insert(erasureLock)
    .values({
      id: "global",
      userId: input.userId,
      operationId,
      leaseUntil: new Date(now.getTime() + 1200000),
    })
    .onConflictDoUpdate({
      target: erasureLock.id,
      set: {
        userId: input.userId,
        operationId,
        leaseUntil: new Date(now.getTime() + 1200000),
      },
      setWhere: sql`(${erasureLock.operationId}=${operationId} AND ${erasureLock.userId}=${input.userId}) OR ${erasureLock.leaseUntil}<${now.getTime()}`,
    })
    .returning();
  if (!lock.length)
    throw new DomainError(
      "conflict",
      "Another account deletion is in progress. Try again shortly.",
      "ERASURE_BUSY"
    );
  try {
    await assertUserErasureAllowed(deps, input.userId);
    // prepareUserDeletion checks every last-owner condition BEFORE invoking the first eraser.
    const plan = await prepareUserDeletion(
      {
        ...deps,
        purgeWorkspaceFiles: (workspaceIds) =>
          deps.eraseWorkspaceArtifacts(workspaceIds, input.userId),
      },
      { userId: input.userId, actor: input.actor }
    );
    await deps.db
      .insert(erasureRecords)
      .values({ userId: input.userId, requestedAt: now })
      .onConflictDoNothing();
    await deps.eraseUserArtifacts({
      userId: input.userId,
      email: person.email,
    });
    return plan;
  } catch (error) {
    await deps.db
      .delete(erasureLock)
      .where(
        and(
          eq(erasureLock.userId, input.userId),
          eq(erasureLock.operationId, operationId)
        )
      );
    throw error;
  }
}
