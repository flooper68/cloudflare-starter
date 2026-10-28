import { DomainError } from "../../kernel";

/** A client batch named an event the catalog does not let the browser send, or bad properties. */
export class InvalidAnalyticsEventError extends DomainError {
  static readonly CODE = "INVALID_ANALYTICS_EVENT";

  constructor(message: string) {
    super("invalid_input", message, InvalidAnalyticsEventError.CODE);
  }
}
