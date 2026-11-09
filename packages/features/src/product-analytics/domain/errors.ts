import { DomainError } from "../../kernel";

/** A client batch named an event the catalog does not let the browser send, or bad properties. */
export class InvalidAnalyticsEventError extends DomainError {
  static readonly CODE = "INVALID_ANALYTICS_EVENT";

  constructor(message: string) {
    super("invalid_input", message, InvalidAnalyticsEventError.CODE);
  }
}

/**
 * The analytics report could not read its events (the token was refused, the API failed):
 * the admin sees why and can retry.
 */
export class AnalyticsUnavailableError extends DomainError {
  static readonly CODE = "ANALYTICS_UNAVAILABLE";

  constructor(message: string) {
    super("unavailable", message, AnalyticsUnavailableError.CODE);
  }
}
