// Composition root for notifications: every notification type the app sends. Features
// declare theirs in their domain (defineNotification) and send them with `deps.notify`;
// listing one here is what lets the dispatcher deliver it and the preferences show it.
// Order is the order of the preferences matrix.
import {
  newSignInNotification,
  passwordChangedNotification,
  securityFactorChangedNotification,
} from "./accounts";
import { containerRunFinishedNotification } from "./container-runs";
import { demoDeletionWarningNotification } from "./demo";
import type { NotificationDefinition } from "./kernel";
import { createNotificationCatalog } from "./notifications";
import { exportReadyNotification } from "./privacy";
import {
  memberJoinedNotification,
  roleChangedNotification,
} from "./workspaces";

export const notificationCatalog = createNotificationCatalog([
  memberJoinedNotification,
  roleChangedNotification,
  passwordChangedNotification,
  newSignInNotification,
  securityFactorChangedNotification,

  exportReadyNotification,

  containerRunFinishedNotification,
  // Demo mode only (DEMO_MODE=on); starter-only, removable with the demo feature.
  demoDeletionWarningNotification,
] as readonly NotificationDefinition<unknown>[]);

/**
 * The catalog the preferences matrix shows: without the demo warning unless DEMO_MODE=on,
 * so a deployment that is not a demo never lists it.
 */
export function preferenceCatalogFor(demoMode: "on" | "off") {
  if (demoMode === "on") return notificationCatalog;
  return createNotificationCatalog(
    [...notificationCatalog.values()].filter(
      (definition) => definition.type !== demoDeletionWarningNotification.type
    )
  );
}
