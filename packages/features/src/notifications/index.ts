// Notifications: in-app inbox and email for events features send with `notify`, per-user
// preferences, daily digests, RFC 8058 one-click unsubscribe, retention
// (docs/guides/how-to-send-notifications.md).
export { archiveNotifications } from "./archive-notifications";
export { countUnreadNotifications } from "./count-unread-notifications";
export { dispatchNotification } from "./dispatch-notification";
export {
  archiveInputSchema,
  createNotificationCatalog,
  DIGEST_HOUR_UTC,
  DIGEST_SCHEDULE,
  deriveUnsubscribeKey,
  dispatchNotificationJob,
  EMAIL_CADENCES,
  type EmailCadence,
  findNotification,
  INBOX_VIEWS,
  type InboxView,
  InvalidNotificationDataError,
  InvalidUnsubscribeTokenError,
  listNotificationsInputSchema,
  MAX_RECIPIENTS,
  markReadInputSchema,
  type NotificationCatalog,
  type NotificationEvent,
  NotificationPreferenceLockedError,
  notificationMail,
  PREFERENCES_PATH,
  type PreferenceRow,
  planDigestsJob,
  preferencesUpdateSchema,
  purgeNotificationsJob,
  READ_RETENTION_DAYS,
  sendDigestJob,
  sendNotificationEmailJob,
  signUnsubscribeToken,
  TooManyRecipientsError,
  UNREAD_RETENTION_DAYS,
  UNSUBSCRIBE_ALL,
  UNSUBSCRIBE_API_PATH,
  UnknownNotificationTypeError,
  verifyUnsubscribeToken,
} from "./domain";
export { getNotificationPreferences } from "./get-notification-preferences";
export {
  type InboxItem,
  listNotifications,
} from "./list-notifications";
export { markNotificationsRead } from "./mark-notifications-read";
export {
  notificationPreferences,
  notificationSettings,
  notifications,
} from "./notifications.schema";
export { notify } from "./notify";
export { planDigests } from "./plan-digests";
export { purgeNotifications } from "./purge-notifications";
export { sendDigest } from "./send-digest";
export {
  type MailApp,
  sendNotificationEmail,
} from "./send-notification-email";
export { unsubscribe } from "./unsubscribe";
export { updateNotificationPreferences } from "./update-notification-preferences";
