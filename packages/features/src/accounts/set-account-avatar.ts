import { eq } from "drizzle-orm";
import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import {
  type Clock,
  type Ids,
  profileImageType,
  type RequestContext,
} from "../kernel";
import { userSettings } from "./user-settings.schema";

/** Write a new immutable image before publishing its reference. Old images are reconciled later. */
export async function setAccountAvatar(
  deps: {
    readonly db: Database;
    readonly bucket: R2Bucket;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  input: {
    readonly userId: string;
    readonly bytes: Uint8Array;
    readonly contentType: string;
  }
) {
  const contentType = profileImageType(input.bytes, input.contentType);
  const [previous] = await deps.db
    .select({ key: userSettings.avatarKey })
    .from(userSettings)
    .where(eq(userSettings.userId, input.userId));
  const version = deps.ids.uuid();
  const key = `users/${input.userId}/avatar/${version}`;
  await deps.bucket.put(key, input.bytes, { httpMetadata: { contentType } });
  await deps.db
    .insert(userSettings)
    .values({ userId: input.userId, avatarKey: key })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { avatarKey: key },
    });
  await recordAuditEvent(deps, deps.requestContext, {
    action: "account.avatar_updated",
    actor: { kind: "user", userId: input.userId },
    target: { type: "user", id: input.userId },
  });
  if (previous?.key) await deps.bucket.delete(previous.key);
  return { avatarUrl: `/api/account/avatar/${encodeURIComponent(version)}` };
}
