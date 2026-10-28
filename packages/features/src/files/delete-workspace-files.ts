import { inArray } from "drizzle-orm";

import type { Database } from "../database";
import { files } from "./files.schema";

/** R2 deletes at most this many keys per call. */
const R2_DELETE_BATCH = 1000;

/**
 * Deletes every file of the given workspaces: the objects in `FILES` first, then the
 * rows, so a failure leaves rows that can be retried rather than orphaned objects. Used
 * when a workspace is deleted (account deletion), where no actor exists.
 */
export async function deleteWorkspaceFiles(
  deps: { readonly db: Database; readonly bucket: R2Bucket },
  input: { readonly workspaceIds: readonly string[] }
): Promise<{ readonly deleted: number }> {
  if (input.workspaceIds.length === 0) return { deleted: 0 };
  const where = inArray(files.workspaceId, [...input.workspaceIds]);
  const rows = await deps.db
    .select({ r2Key: files.r2Key })
    .from(files)
    .where(where);

  const keys = rows.map((row) => row.r2Key);
  for (let start = 0; start < keys.length; start += R2_DELETE_BATCH) {
    await deps.bucket.delete(keys.slice(start, start + R2_DELETE_BATCH));
  }
  await deps.db.delete(files).where(where);
  return { deleted: keys.length };
}
