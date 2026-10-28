import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import {
  deriveUnsubscribeKey,
  InvalidUnsubscribeTokenError,
  isLocked,
  type NotificationCatalog,
  UNSUBSCRIBE_ALL,
  verifyUnsubscribeToken,
} from "./domain";
import { notificationPreferences } from "./notifications.schema";

/**
 * One-click unsubscribe (RFC 8058) from the link in a notification mail: verifies the
 * signed token and turns the email channel off for its type, or for every type that can
 * be turned off when the link came from a digest. Security types are never touched.
 * Repeating it is harmless. Throws InvalidUnsubscribeTokenError for a bad token. Records
 * `notifications.unsubscribed` (the token holder acts as the user it names).
 */
export async function unsubscribe(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly catalog: NotificationCatalog;
    /** BETTER_AUTH_SECRET: the key is derived from it (HKDF). */
    readonly secret: string;
  },
  input: { readonly token: string }
): Promise<{ readonly userId: string; readonly types: readonly string[] }> {
  const target = await verifyUnsubscribeToken(
    await deriveUnsubscribeKey(deps.secret),
    input.token
  );
  if (!target) throw new InvalidUnsubscribeTokenError();
  const definitions =
    target.type === UNSUBSCRIBE_ALL
      ? [...deps.catalog.values()]
      : [deps.catalog.get(target.type)].flatMap((d) => (d ? [d] : []));
  const types = definitions
    .filter((definition) => !isLocked(definition))
    .map((definition) => definition.type);

  const p = notificationPreferences;
  const [first, ...rest] = types.map((type) =>
    deps.db
      .insert(p)
      .values({ userId: target.userId, type, channel: "email", enabled: false })
      .onConflictDoUpdate({
        target: [p.userId, p.type, p.channel],
        set: { enabled: false },
      })
  );
  // A user deleted since the mail was sent: the FK fails; nothing to unsubscribe.
  if (first) {
    try {
      await deps.db.batch([first, ...rest]);
    } catch (error) {
      if (/FOREIGN KEY/i.test(String(error))) {
        return { userId: target.userId, types: [] };
      }
      throw error;
    }
  }

  await recordAuditEvent(deps, deps.requestContext, {
    action: "notifications.unsubscribed",
    actor: { kind: "user", userId: target.userId },
    workspaceId: null,
    target: { type: "user", id: target.userId },
    metadata: { type: target.type.slice(0, 100), channel: "email" },
  });
  return { userId: target.userId, types };
}
