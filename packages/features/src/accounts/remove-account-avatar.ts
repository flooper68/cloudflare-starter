import { eq } from "drizzle-orm";
import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { userSettings } from "./user-settings.schema";

/** Unpublish the custom avatar; old immutable versions are storage-reconciliation candidates. */
export async function removeAccountAvatar(
  deps: {
    readonly db: Database;
    readonly bucket: R2Bucket;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  input: { readonly userId: string }
) {
  const [previous] = await deps.db
    .select({ key: userSettings.avatarKey })
    .from(userSettings)
    .where(eq(userSettings.userId, input.userId));
  await deps.db
    .update(userSettings)
    .set({ avatarKey: null })
    .where(eq(userSettings.userId, input.userId));
  await recordAuditEvent(deps, deps.requestContext, {
    action: "account.avatar_removed",
    actor: { kind: "user", userId: input.userId },
    target: { type: "user", id: input.userId },
  });
  if (previous?.key) await deps.bucket.delete(previous.key);
  return { removed: true };
}
