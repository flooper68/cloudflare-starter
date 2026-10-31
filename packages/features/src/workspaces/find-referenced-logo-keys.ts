import { inArray } from "drizzle-orm";
import type { Database } from "../database";
import { workspaces } from "./workspaces.schema";

/** System/admin storage reconciliation: current references across all owners. */
export async function findReferencedLogoKeys(
  deps: { readonly db: Database },
  keys: readonly string[]
): Promise<ReadonlySet<string>> {
  const found = new Set<string>();
  for (let offset = 0; offset < keys.length; offset += 50) {
    const rows = await deps.db
      .select({ key: workspaces.logoKey })
      .from(workspaces)
      .where(inArray(workspaces.logoKey, keys.slice(offset, offset + 50)));
    for (const row of rows) if (row.key) found.add(row.key);
  }
  return found;
}
