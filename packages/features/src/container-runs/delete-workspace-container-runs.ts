import { inArray } from "drizzle-orm";

import type { Database } from "../database";
import { containerRuns } from "./container-runs.schema";

/** R2 deletes at most this many keys per call. */
const R2_DELETE_BATCH = 1000;

/**
 * Deletes every container run of the given workspaces with its R2 result, objects first.
 * Called by erasure when a workspace is deleted (no actor remains); the rows would also
 * cascade with the workspace, the objects would not.
 */
export async function deleteWorkspaceContainerRuns(
  deps: { readonly db: Database; readonly bucket: R2Bucket },
  input: { readonly workspaceIds: readonly string[] }
): Promise<{ readonly deleted: number }> {
  if (input.workspaceIds.length === 0) return { deleted: 0 };
  const where = inArray(containerRuns.workspaceId, [...input.workspaceIds]);
  const rows = await deps.db
    .select({ resultKey: containerRuns.resultKey })
    .from(containerRuns)
    .where(where);
  const keys = rows.flatMap((row) => (row.resultKey ? [row.resultKey] : []));
  for (let start = 0; start < keys.length; start += R2_DELETE_BATCH) {
    await deps.bucket.delete(keys.slice(start, start + R2_DELETE_BATCH));
  }
  await deps.db.delete(containerRuns).where(where);
  return { deleted: rows.length };
}
