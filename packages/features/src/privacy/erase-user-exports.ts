import { eq, sql } from "drizzle-orm";
import type { Database } from "../database";
import { dataRequests } from "./privacy.schema";
/** Invalidate first, then remove complete/incomplete archives before deleting request rows. */
export async function eraseUserExports(
  deps: { readonly db: Database; readonly bucket: R2Bucket },
  input: { readonly userId?: string; readonly workspaceIds?: readonly string[] }
) {
  const t = dataRequests;
  const predicate = input.userId
    ? eq(t.userId, input.userId)
    : sql`${t.scope}='workspace' AND ${t.subjectId} IN (${sql.join(
        (input.workspaceIds ?? []).map((id) => sql`${id}`),
        sql`, `
      )})`;
  if (!input.userId && !input.workspaceIds?.length) return;
  for (;;) {
    const rows = await deps.db.select().from(t).where(predicate).limit(50);
    if (!rows.length) break;
    for (const row of rows) {
      await deps.db
        .update(t)
        .set({ status: "expired", attemptId: null })
        .where(eq(t.id, row.id));
      if (row.uploadId && row.objectKey)
        await deps.bucket
          .resumeMultipartUpload(row.objectKey, row.uploadId)
          .abort();
      if (row.objectKey) await deps.bucket.delete(row.objectKey);
      await deps.db.delete(t).where(eq(t.id, row.id));
    }
  }
}
