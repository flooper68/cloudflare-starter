import { and, eq, sql } from "drizzle-orm";

import type { Database } from "../database";
import type { Clock, Ids, JobEnvelope } from "../kernel";
import type { JobQueue, Logger } from "../platform";
import {
  claimWindow,
  completedExpiry,
  JobLockedError,
  type JobRun,
  type RegisteredJob,
} from "./domain";
import { jobIdempotencyKeys } from "./jobs.schema";

/**
 * What every job handler may use. Handlers declare the subset they need
 * (`(deps: { logger: Logger }, payload) => …`); the consumer passes all of it.
 */
export interface JobDeps {
  readonly db: Database;
  readonly clock: Clock;
  readonly ids: Ids;
  /** Bound to the delivery's request context: records carry the producer's trace. */
  readonly logger: Logger;
  /** For jobs that fan out into more jobs. */
  readonly jobQueue: JobQueue;
  /** The `FILES` bucket: purges remove objects before rows. */
  readonly bucket: R2Bucket;
}

/**
 * Runs one delivery of a job. A job with an idempotency key (`envelope.idempotencykey`)
 * first claims it: a key already done is `skipped`; a key another run holds throws
 * JobLockedError (retried). On success the key is marked done for 7 days; on failure the
 * claim is released so the retry can take it, and the error is rethrown for the consumer
 * to classify (retry, permanent, final).
 */
export async function runJob(
  deps: JobDeps,
  job: RegisteredJob<JobDeps>,
  envelope: JobEnvelope,
  run: JobRun
): Promise<"completed" | "skipped"> {
  const key = envelope.idempotencykey;
  if (!key) {
    await job.run(deps, envelope.data, run);
    return "completed";
  }

  const t = jobIdempotencyKeys;
  const now = deps.clock.now();
  const { lockedUntil, expiresAt } = claimWindow(now);
  // Claim: insert, or take over a key that expired, whose lock ran out (the run that held
  // it died), or that this same job held on an earlier delivery. A done key blocks.
  const claimed = await deps.db
    .insert(t)
    .values({
      key,
      jobType: envelope.type,
      jobId: envelope.id,
      status: "in_progress",
      lockedUntil,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: t.key,
      set: {
        jobType: envelope.type,
        jobId: envelope.id,
        status: "in_progress",
        lockedUntil,
        expiresAt,
      },
      setWhere: sql`${t.expiresAt} <= ${now.getTime()} or (${t.status} = 'in_progress' and (${t.lockedUntil} <= ${now.getTime()} or ${t.jobId} = ${envelope.id}))`,
    })
    .returning({ key: t.key });

  if (claimed.length === 0) {
    const [existing] = await deps.db
      .select({ status: t.status })
      .from(t)
      .where(eq(t.key, key));
    if (existing?.status === "done") return "skipped";
    throw new JobLockedError(key);
  }

  try {
    await job.run(deps, envelope.data, run);
  } catch (error) {
    await deps.db
      .delete(t)
      .where(
        and(
          eq(t.key, key),
          eq(t.jobId, envelope.id),
          eq(t.status, "in_progress")
        )
      );
    throw error;
  }

  await deps.db
    .update(t)
    .set({
      status: "done",
      lockedUntil: null,
      expiresAt: completedExpiry(deps.clock.now()),
    })
    .where(and(eq(t.key, key), eq(t.jobId, envelope.id)));
  return "completed";
}
