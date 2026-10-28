import { lte } from "drizzle-orm";

import type { Database } from "../database";
import type { Clock } from "../kernel";
import { jobIdempotencyKeys } from "./jobs.schema";

/** Deletes idempotency keys past their expiry (indexed on expires_at); returns how many. */
export async function purgeIdempotencyKeys(deps: {
  readonly db: Database;
  readonly clock: Clock;
}): Promise<{ readonly deleted: number }> {
  const result = await deps.db
    .delete(jobIdempotencyKeys)
    .where(lte(jobIdempotencyKeys.expiresAt, deps.clock.now()));
  return { deleted: result.meta.changes };
}
