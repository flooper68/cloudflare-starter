import { and, eq } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import {
  findNotification,
  isLocked,
  type NotificationCatalog,
  NotificationPreferenceLockedError,
  type PreferencesUpdate,
  storedOverride,
} from "./domain";
import {
  notificationPreferences,
  notificationSettings,
} from "./notifications.schema";

/**
 * Changes the user's notification preferences: channel switches per type (stored only
 * where they differ from the type's default) and the email cadence. Refuses unknown types
 * and security types (locked) before writing anything; all changes are one batch.
 * Records `notifications.preferences_changed`.
 */
export async function updateNotificationPreferences(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly catalog: NotificationCatalog;
  },
  input: PreferencesUpdate & { readonly userId: string }
): Promise<{ readonly changed: number }> {
  const p = notificationPreferences;
  const statements = input.changes.map((change) => {
    const definition = findNotification(deps.catalog, change.type);
    if (isLocked(definition)) {
      throw new NotificationPreferenceLockedError(change.type);
    }
    const key = and(
      eq(p.userId, input.userId),
      eq(p.type, change.type),
      eq(p.channel, change.channel)
    );
    return storedOverride(definition, change.channel, change.enabled) ===
      "delete"
      ? deps.db.delete(p).where(key)
      : deps.db
          .insert(p)
          .values({
            userId: input.userId,
            type: change.type,
            channel: change.channel,
            enabled: change.enabled,
          })
          .onConflictDoUpdate({
            target: [p.userId, p.type, p.channel],
            set: { enabled: change.enabled },
          });
  });
  const cadence = input.emailCadence;
  const all = [
    ...statements,
    ...(cadence
      ? [
          deps.db
            .insert(notificationSettings)
            .values({ userId: input.userId, emailCadence: cadence })
            .onConflictDoUpdate({
              target: notificationSettings.userId,
              set: { emailCadence: cadence },
            }),
        ]
      : []),
  ];
  const [first, ...rest] = all;
  if (!first) return { changed: 0 };
  await deps.db.batch([first, ...rest]);

  await recordAuditEvent(deps, deps.requestContext, {
    action: "notifications.preferences_changed",
    actor: { kind: "user", userId: input.userId },
    workspaceId: null,
    target: { type: "user", id: input.userId },
    metadata: {
      changes: input.changes.length,
      ...(cadence ? { emailCadence: cadence } : {}),
    },
  });
  return { changed: all.length };
}
