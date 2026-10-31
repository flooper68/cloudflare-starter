import { eq, sql } from "drizzle-orm";

import type { Database } from "../database";
import { files } from "./files.schema";

/**
 * Bytes a workspace stores: the sum of its files' sizes, trashed files included (R2 keeps
 * them until the purge, and counting them stops trash-and-restore from dodging the
 * limit; deliberately not `liveIn`). The `storage_bytes` metric of the
 * billing catalog (source `files.measureWorkspaceStorage`); billing calls it for a
 * workspace its caller has already authorized.
 */
export async function measureWorkspaceStorage(
  deps: { readonly db: Database },
  input: { readonly workspaceId: string }
): Promise<number> {
  const [row] = await deps.db
    .select({ total: sql<number>`coalesce(sum(${files.sizeBytes}), 0)` })
    .from(files)
    .where(eq(files.workspaceId, input.workspaceId));
  return Number(row?.total ?? 0);
}
