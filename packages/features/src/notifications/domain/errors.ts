import { DomainError } from "../../kernel";

/** No notification of this type is in the catalog (removed, or a typo in a producer). */
export class UnknownNotificationTypeError extends DomainError {
  constructor(type: string) {
    super("invalid_input", `Unknown notification type "${type}"`);
  }
}

/** The data does not match the notification's schema. */
export class InvalidNotificationDataError extends DomainError {
  readonly issues: unknown;

  constructor(type: string, issues: unknown) {
    super("invalid_input", `Invalid data for notification "${type}"`);
    this.issues = issues;
  }
}

/** More recipients than one event may have; the producer splits the work. */
export class TooManyRecipientsError extends DomainError {
  constructor(max: number) {
    super("invalid_input", `A notification goes to at most ${max} recipients`);
  }
}

/** Security notifications cannot be turned off. */
export class NotificationPreferenceLockedError extends DomainError {
  static readonly CODE = "NOTIFICATION_PREFERENCE_LOCKED";

  constructor(type: string) {
    super(
      "invalid_input",
      `"${type}" is a security notification and cannot be turned off`,
      NotificationPreferenceLockedError.CODE
    );
  }
}

/** The unsubscribe link is malformed, tampered with, or signed with another key. */
export class InvalidUnsubscribeTokenError extends DomainError {
  static readonly CODE = "INVALID_UNSUBSCRIBE_TOKEN";

  constructor() {
    super(
      "invalid_input",
      "This unsubscribe link is not valid. Change your email settings in the app instead.",
      InvalidUnsubscribeTokenError.CODE
    );
  }
}
