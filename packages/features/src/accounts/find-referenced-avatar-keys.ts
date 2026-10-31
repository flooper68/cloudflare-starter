import { inArray } from "drizzle-orm";
import type { Database } from "../database";
import { userSettings } from "./user-settings.schema";

/** System/admin storage reconciliation: current references across all owners. */
export async function findReferencedAvatarKeys(
  deps: { readonly db: Database },
  keys: readonly string[]
): Promise<ReadonlySet<string>> {
  const found = new Set<string>();
  for (let offset = 0; offset < keys.length; offset += 50) {
    const rows = await deps.db
      .select({ key: userSettings.avatarKey })
      .from(userSettings)
      .where(inArray(userSettings.avatarKey, keys.slice(offset, offset + 50)));
    for (const row of rows) if (row.key) found.add(row.key);
  }
  return found;
}
