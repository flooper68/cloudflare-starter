import { inArray, lte } from "drizzle-orm";

import type { Database } from "../database";
import { containerRuns } from "./container-runs.schema";

/** Runs deleted per call; the daily job runs again tomorrow for the rest. */
const PURGE_BATCH = 500;

/**
 * Retention of the container demo: deletes runs whose `expires_at` is at or before `asOf`
 * (CONTAINER_RUN_RETENTION_DAYS after they started), their R2 results first, then the
 * rows, so a failure leaves rows to retry rather than orphaned objects. At most
 * PURGE_BATCH per call. The job `container-runs.purge` runs it daily.
 */
export async function purgeContainerRuns(
  deps: { readonly db: Database; readonly bucket: R2Bucket },
  input: { readonly asOf: string }
): Promise<{ readonly deleted: number }> {
  const rows = await deps.db
    .select({ id: containerRuns.id, resultKey: containerRuns.resultKey })
    .from(containerRuns)
    .where(lte(containerRuns.expiresAt, new Date(input.asOf)))
    .limit(PURGE_BATCH);
  if (rows.length === 0) return { deleted: 0 };
  const keys = rows.flatMap((row) => (row.resultKey ? [row.resultKey] : []));
  if (keys.length > 0) await deps.bucket.delete(keys);
  await deps.db.delete(containerRuns).where(
    inArray(
      containerRuns.id,
      rows.map((row) => row.id)
    )
  );
  return { deleted: rows.length };
}
