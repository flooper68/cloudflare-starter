import { desc } from "drizzle-orm";
import type { AdminActor } from "../admin";
import type { Database } from "../database";
import { dataRequests, erasureRecords } from "./privacy.schema";
/** Platform-admin metadata only; never reveals archive keys or download signatures. */
export async function listAdminDataRequests(
  deps: { readonly db: Database },
  _admin: AdminActor
) {
  const t = dataRequests;
  return {
    exports: await deps.db
      .select({
        id: t.id,
        userId: t.userId,
        scope: t.scope,
        subjectId: t.subjectId,
        status: t.status,
        createdAt: t.createdAt,
        expiresAt: t.expiresAt,
        failure: t.failure,
      })
      .from(t)
      .orderBy(desc(t.createdAt))
      .limit(100),
    erasures: await deps.db
      .select()
      .from(erasureRecords)
      .orderBy(desc(erasureRecords.requestedAt))
      .limit(100),
  };
}
