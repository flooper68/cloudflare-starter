import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../database";
import { enqueueJob } from "../jobs";
import type { Clock, Ids, RequestContext } from "../kernel";
import type { JobQueue } from "../platform";
import {
  PRESIGNED_UPLOAD_CLEANUP_DELAY_SECONDS,
  retryFileCleanupsJob,
} from "./domain";
import { pendingFileCleanup } from "./files.schema";
/** Refresh all targets before publishing one bounded dispatcher; queue failure cannot shorten the window. */
export async function scheduleErasureStorage(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly jobQueue: JobQueue;
    readonly requestContext: RequestContext;
  },
  input: { readonly userId: string }
) {
  const t = pendingFileCleanup;
  const deadline = new Date(
    deps.clock.now().getTime() + PRESIGNED_UPLOAD_CLEANUP_DELAY_SECONDS * 1000
  );
  const owned = and(eq(t.userId, input.userId), eq(t.kind, "erasure"));
  await deps.db
    .update(t)
    .set({
      notBefore: sql`max(${t.notBefore},${deadline.getTime()})`,
      cursor: null,
      sweep: 0,
    })
    .where(owned);
  const [pending] = await deps.db
    .select({ target: t.target })
    .from(t)
    .where(owned)
    .limit(1);
  if (!pending) return { queued: 0 };
  await enqueueJob(
    deps,
    retryFileCleanupsJob,
    {},
    {
      context: { ...deps.requestContext, ip: null },
      delaySeconds: PRESIGNED_UPLOAD_CLEANUP_DELAY_SECONDS,
    }
  );
  return { queued: 1 };
}
