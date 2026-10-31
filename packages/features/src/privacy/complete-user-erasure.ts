import { and, eq, isNull } from "drizzle-orm";
import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import { scheduleErasureStorage } from "../files";
import type { Clock, Ids, RequestContext } from "../kernel";
import type { EmailService, ErrorReporter, JobQueue } from "../platform";
import { erasureLock, erasureRecords } from "./privacy.schema";
/** Idempotent after-auth hook: durable minimal record, credential-free audit and confirmation mail. */
export async function completeUserErasure(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly email: EmailService;
    readonly errors: ErrorReporter;
    readonly jobQueue: JobQueue;
  },
  input: {
    readonly userId: string;
    readonly email: string;
    readonly operationId: string;
  }
) {
  const [held] = await deps.db
    .select({ id: erasureLock.id })
    .from(erasureLock)
    .where(
      and(
        eq(erasureLock.userId, input.userId),
        eq(erasureLock.operationId, input.operationId)
      )
    );
  if (!held) return;
  const completed = await deps.db
    .update(erasureRecords)
    .set({ completedAt: deps.clock.now() })
    .where(
      and(
        eq(erasureRecords.userId, input.userId),
        isNull(erasureRecords.completedAt)
      )
    )
    .returning();
  await deps.db
    .delete(erasureLock)
    .where(
      and(
        eq(erasureLock.userId, input.userId),
        eq(erasureLock.operationId, input.operationId)
      )
    );
  if (!completed.length) return;
  try {
    await scheduleErasureStorage(deps, { userId: input.userId });
  } catch (error) {
    deps.errors.capture(
      error,
      { ...deps.requestContext, ip: null },
      { "app.privacy.operation": "schedule_erasure_storage" }
    );
  }

  await recordAuditEvent(
    deps,
    { ...deps.requestContext, ip: null },
    {
      action: "privacy.user_erased",
      target: { type: "user", id: input.userId },
      metadata: {},
    }
  );
  if (deps.email.enabled) {
    try {
      await deps.email.send({
        to: { email: input.email },
        subject: "Your account was deleted",
        text: "Your account and personal workspaces have been deleted. Shared workspace records and the documented audit/backup retention may remain.",
        html: "<p>Your account and personal workspaces have been deleted.</p><p>Shared workspace records and the documented audit/backup retention may remain.</p>",
      });
    } catch (error) {
      deps.errors.capture(
        error,
        { ...deps.requestContext, ip: null },
        { "app.privacy.operation": "erasure_confirmation" }
      );
    }
  }
}
