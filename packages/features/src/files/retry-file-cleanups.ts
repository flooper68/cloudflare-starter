import { and, asc, gt, lte } from "drizzle-orm";
import type { Database } from "../database";
import { enqueueJob } from "../jobs";
import type { Clock, Ids, RequestContext } from "../kernel";
import type { JobQueue } from "../platform";
import { cleanupStorageJob, retryFileCleanupsJob } from "./domain";
import { pendingFileCleanup } from "./files.schema";
/** Hourly repair for failed cleanup/enqueue attempts; keyset pages prevent permanent failures starving later targets. */
export async function retryFileCleanups(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly jobQueue: JobQueue;
    readonly requestContext: RequestContext;
  },
  input: { readonly cursor?: string }
) {
  const t = pendingFileCleanup;
  const rows = await deps.db
    .select({ target: t.target })
    .from(t)
    .where(
      and(
        lte(t.notBefore, deps.clock.now()),
        input.cursor ? gt(t.target, input.cursor) : undefined
      )
    )
    .orderBy(asc(t.target))
    .limit(50);
  for (const row of rows)
    await enqueueJob(
      deps,
      cleanupStorageJob,
      { target: row.target },
      { context: deps.requestContext }
    );
  if (rows.length === 50)
    await enqueueJob(
      deps,
      retryFileCleanupsJob,
      { cursor: rows.at(-1)?.target },
      { context: deps.requestContext }
    );
  return { queued: rows.length };
}
