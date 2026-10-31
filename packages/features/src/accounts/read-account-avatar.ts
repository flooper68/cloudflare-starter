import { eq } from "drizzle-orm";
import type { Database } from "../database";
import { DomainError } from "../kernel";
import { userSettings } from "./user-settings.schema";

/** A private current avatar, never an arbitrary bucket key or another user's image. */
export async function readAccountAvatar(
  deps: { readonly db: Database; readonly bucket: R2Bucket },
  input: { readonly userId: string; readonly version: string }
) {
  const [row] = await deps.db
    .select({ key: userSettings.avatarKey })
    .from(userSettings)
    .where(eq(userSettings.userId, input.userId));
  if (!row?.key || row.key !== `users/${input.userId}/avatar/${input.version}`)
    throw new DomainError("not_found", "Image not found");
  const object = await deps.bucket.get(row.key);
  if (!object) throw new DomainError("not_found", "Image not found");
  return object;
}
