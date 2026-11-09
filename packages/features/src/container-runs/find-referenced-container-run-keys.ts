import { inArray } from "drizzle-orm";

import type { Database } from "../database";
import { containerRuns } from "./container-runs.schema";

/**
 * System storage maintenance: which of these result keys a run still references. A result
 * whose run is gone (its workspace deleted) is an orphan for the reconciliation.
 */
export async function findReferencedContainerRunKeys(
  deps: { readonly db: Database },
  keys: readonly string[]
): Promise<ReadonlySet<string>> {
  const found = new Set<string>();
  for (let start = 0; start < keys.length; start += 50) {
    const rows = await deps.db
      .select({ key: containerRuns.resultKey })
      .from(containerRuns)
      .where(inArray(containerRuns.resultKey, keys.slice(start, start + 50)));
    for (const row of rows) if (row.key) found.add(row.key);
  }
  return found;
}
