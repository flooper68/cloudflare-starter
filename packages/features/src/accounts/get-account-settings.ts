import { eq } from "drizzle-orm";
import type { Database } from "../database";
import { userSettings } from "./user-settings.schema";

/** Read personal preferences. Absent rows use documented, explicit UI defaults. */
export async function getAccountSettings(
  deps: { readonly db: Database },
  input: { readonly userId: string }
) {
  const [row] = await deps.db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, input.userId));
  return {
    theme: row?.theme ?? ("system" as const),
    timezone: row?.timezone ?? "UTC",
    locale: row?.locale ?? "en",
    avatarUrl: row?.avatarKey
      ? `/api/account/avatar/${encodeURIComponent(row.avatarKey.split("/").at(-1) ?? "")}`
      : null,
  };
}
