import { eq, sql } from "drizzle-orm";
import type { Database } from "../database";
import { enqueueJob } from "../jobs";
import type { Clock, Ids, RequestContext } from "../kernel";
import type { JobQueue } from "../platform";
import { purgeDataExportsJob } from "./domain";
import { dataRequests } from "./privacy.schema";
/** Expired downloads and abandoned attempts; small rounds, continued through the queue. */
export async function purgeDataExports(
  deps: {
    readonly db: Database;
    readonly bucket: R2Bucket;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly jobQueue: JobQueue;
    readonly requestContext: RequestContext;
  },
  input: { readonly asOf: string }
) {
  const t = dataRequests;
  const now = Date.parse(input.asOf);
  const rows = await deps.db
    .select()
    .from(t)
    .where(
      sql`(${t.status} IN ('expired','failed') AND ${t.objectKey} IS NOT NULL) OR (${t.status}='ready' AND ${t.expiresAt}<=${now}) OR (${t.status} IN ('queued','building') AND ${t.createdAt}<${now - 86400000})`
    )
    .limit(50);
  for (const row of rows) {
    await deps.db.update(t).set({ status: "expired" }).where(eq(t.id, row.id));
    if (row.uploadId && row.objectKey)
      await deps.bucket
        .resumeMultipartUpload(row.objectKey, row.uploadId)
        .abort();
    if (row.objectKey) await deps.bucket.delete(row.objectKey);
    await deps.db
      .update(t)
      .set({ objectKey: null, uploadId: null, leaseUntil: null })
      .where(eq(t.id, row.id));
  }
  if (rows.length === 50)
    await enqueueJob(deps, purgeDataExportsJob, input, {
      context: deps.requestContext,
    });
  return { purged: rows.length };
}
