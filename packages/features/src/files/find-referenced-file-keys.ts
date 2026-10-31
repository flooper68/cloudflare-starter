import { inArray } from "drizzle-orm";
import type { Database } from "../database";
import { files } from "./files.schema";

/** System storage maintenance: protect every row, including trash and pending uploads. */
export async function findReferencedFileKeys(
  deps: { readonly db: Database },
  keys: readonly string[]
): Promise<ReadonlySet<string>> {
  const found = new Set<string>();
  for (let start = 0; start < keys.length; start += 50) {
    const rows = await deps.db
      .select({ key: files.r2Key })
      .from(files)
      .where(inArray(files.r2Key, keys.slice(start, start + 50)));
    for (const row of rows) found.add(row.key);
  }
  return found;
}
