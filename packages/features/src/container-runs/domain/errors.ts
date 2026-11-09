import { DomainError } from "../../kernel";

/** The run does not exist or belongs to another workspace (indistinguishable on purpose). */
export class ContainerRunNotFoundError extends DomainError {
  constructor() {
    super("not_found", "Container run not found");
  }
}

/** CONTAINER_DEMO=off in this environment: no new runs. */
export class ContainerDemoOffError extends DomainError {
  constructor() {
    super(
      "unavailable",
      "The container workflow demo is turned off in this environment",
      "CONTAINER_DEMO_OFF"
    );
  }
}

/** The deployment's runs for today (UTC) reached CONTAINER_DEMO_DAILY_CAP. */
export class ContainerDemoDailyCapError extends DomainError {
  constructor(dailyCap: number) {
    super(
      "rate_limited",
      "Today's container runs are used up; the demo opens again at 00:00 UTC",
      "CONTAINER_DEMO_DAILY_CAP",
      { dailyCap }
    );
  }
}

/** The user started CONTAINER_RUN_USER_HOURLY_LIMIT runs this UTC hour. */
export class ContainerRunHourlyLimitError extends DomainError {
  constructor(limit: number) {
    super(
      "rate_limited",
      `You can start ${limit} container runs per hour; try again later`,
      "CONTAINER_RUN_HOURLY_LIMIT",
      { limit }
    );
  }
}

/** Only a failed run can be retried. */
export class ContainerRunNotRetryableError extends DomainError {
  constructor() {
    super(
      "conflict",
      "Only a failed run can be retried",
      "CONTAINER_RUN_NOT_RETRYABLE"
    );
  }
}

/** The run has no stored result (not finished, failed, or expired). */
export class ContainerRunResultUnavailableError extends DomainError {
  constructor() {
    super(
      "not_found",
      "This run has no result to download",
      "CONTAINER_RUN_RESULT_UNAVAILABLE"
    );
  }
}
