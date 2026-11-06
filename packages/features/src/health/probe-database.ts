import { sql } from "drizzle-orm";

import type { Database } from "../database";

/**
 * The readiness probe of D1: one `SELECT 1` round trip. Reads no table and no rows and
 * writes nothing; throws when D1 does not answer.
 */
export async function probeDatabase(deps: {
  readonly db: Database;
}): Promise<void> {
  await deps.db.run(sql`select 1`);
}
