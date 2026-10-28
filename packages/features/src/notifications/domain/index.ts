// Notifications domain: catalog checks, preferences, digest, retention, unsubscribe
// tokens, the mail layout and the job definitions. Pure (Web Crypto for the HMAC only).
export {
  createNotificationCatalog,
  findNotification,
  NOTIFICATION_TYPE_PATTERN,
  type NotificationCatalog,
} from "./catalog";
export {
  DIGEST_HOUR_UTC,
  DIGEST_SCHEDULE,
  type DigestEntry,
  type DigestGroup,
  digestContent,
  digestDate,
  groupDigest,
} from "./digest";
export {
  type NotificationMail,
  notificationMail,
  PREFERENCES_PATH,
  UNSUBSCRIBE_API_PATH,
  unsubscribeUrl,
} from "./email-layout";
export {
  InvalidNotificationDataError,
  InvalidUnsubscribeTokenError,
  NotificationPreferenceLockedError,
  TooManyRecipientsError,
  UnknownNotificationTypeError,
} from "./errors";
export {
  archiveInputSchema,
  decodeInboxCursor,
  encodeInboxCursor,
  INBOX_VIEWS,
  type InboxCursor,
  type InboxView,
  type ListNotificationsInput,
  listNotificationsInputSchema,
  type MarkReadInput,
  markReadInputSchema,
  type PreferencesUpdate,
  preferencesUpdateSchema,
} from "./inbox";
export {
  dispatchNotificationJob,
  MAX_RECIPIENTS,
  type NotificationEvent,
  notificationEventSchema,
  planDigestsJob,
  purgeNotificationsJob,
  sendDigestJob,
  sendNotificationEmailJob,
} from "./jobs";
export {
  DEFAULT_EMAIL_CADENCE,
  EMAIL_CADENCES,
  type EmailCadence,
  type EmailState,
  initialEmailState,
  isLocked,
  type PreferenceOverride,
  type PreferenceRow,
  preferenceMatrix,
  type ResolvedChannels,
  resolveChannels,
  storedOverride,
} from "./preferences";
export {
  notificationRetentionCutoffs,
  READ_RETENTION_DAYS,
  UNREAD_RETENTION_DAYS,
} from "./retention";
export {
  deriveUnsubscribeKey,
  signUnsubscribeToken,
  UNSUBSCRIBE_ALL,
  UNSUBSCRIBE_KEY_INFO,
  type UnsubscribeTarget,
  verifyUnsubscribeToken,
} from "./unsubscribe-token";
