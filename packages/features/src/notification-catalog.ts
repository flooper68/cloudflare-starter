// Composition root for notifications: every notification type the app sends. Features
// declare theirs in their domain (defineNotification) and send them with `deps.notify`;
// listing one here is what lets the dispatcher deliver it and the preferences show it.
// Order is the order of the preferences matrix.
import {
  newSignInNotification,
  passwordChangedNotification,
  securityFactorChangedNotification,
} from "./accounts";
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
] as readonly NotificationDefinition<unknown>[]);
