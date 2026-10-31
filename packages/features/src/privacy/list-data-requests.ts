import { desc, eq } from "drizzle-orm";
import type { Database } from "../database";
import { dataRequests } from "./privacy.schema";
/** A person's requests only; internal keys, multipart ids and attempt state never leave. */
export async function listDataRequests(
  deps: { readonly db: Database },
  userId: string
) {
  const t = dataRequests;
  return deps.db
    .select({
      id: t.id,
      scope: t.scope,
      subjectId: t.subjectId,
      status: t.status,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt,
      sizeBytes: t.sizeBytes,
      failure: t.failure,
    })
    .from(t)
    .where(eq(t.userId, userId))
    .orderBy(desc(t.createdAt))
    .limit(100);
}
