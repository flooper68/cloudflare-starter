import { DomainError } from "../../kernel";
import type { RateLimitPolicyId } from "./policies";

/** A rate-limit policy refused the request; adapters answer 429 with Retry-After. */
export class RateLimitedError extends DomainError {
  static readonly CODE = "RATE_LIMITED";
  readonly policy: RateLimitPolicyId;
  readonly retryAfterSeconds: number;

  constructor(policy: RateLimitPolicyId, retryAfterSeconds: number) {
    super(
      "rate_limited",
      `Too many requests. Try again in ${retryAfterSeconds} seconds.`,
      RateLimitedError.CODE
    );
    this.policy = policy;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** The human check (Turnstile) refused the request: no token, or an invalid one. */
export class HumanCheckFailedError extends DomainError {
  static readonly CODE = "HUMAN_CHECK_FAILED";

  constructor() {
    super(
      "invalid_input",
      "The human check did not pass. Try again.",
      HumanCheckFailedError.CODE
    );
  }
}

/** The human check could not be done (the provider did not answer); the request is refused. */
export class HumanCheckUnavailableError extends DomainError {
  static readonly CODE = "HUMAN_CHECK_UNAVAILABLE";

  constructor() {
    super(
      "unavailable",
      "We could not check that you are human. Try again.",
      HumanCheckUnavailableError.CODE
    );
  }
}
