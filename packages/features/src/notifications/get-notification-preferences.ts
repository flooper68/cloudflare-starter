import { eq } from "drizzle-orm";

import type { Database } from "../database";
import {
  DEFAULT_EMAIL_CADENCE,
  type EmailCadence,
  type NotificationCatalog,
  type PreferenceRow,
  preferenceMatrix,
} from "./domain";
import {
  notificationPreferences,
  notificationSettings,
} from "./notifications.schema";

/**
 * The user's notification preferences: every catalog type with its in-app and email
 * switches (security types locked on), the email cadence, and whether this deployment
 * sends email at all.
 */
export async function getNotificationPreferences(
  deps: {
    readonly db: Database;
    readonly catalog: NotificationCatalog;
    readonly emailEnabled: boolean;
  },
  input: { readonly userId: string }
): Promise<{
  readonly types: readonly PreferenceRow[];
  readonly emailCadence: EmailCadence;
  readonly emailAvailable: boolean;
}> {
  const [overrides, settings] = await Promise.all([
    deps.db
      .select({
        type: notificationPreferences.type,
        channel: notificationPreferences.channel,
        enabled: notificationPreferences.enabled,
      })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, input.userId)),
    deps.db
      .select({ emailCadence: notificationSettings.emailCadence })
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, input.userId)),
  ]);
  return {
    types: preferenceMatrix(deps.catalog, overrides),
    emailCadence: settings[0]?.emailCadence ?? DEFAULT_EMAIL_CADENCE,
    emailAvailable: deps.emailEnabled,
  };
}
