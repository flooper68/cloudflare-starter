import { DomainError } from "../../kernel";

/** A job's payload does not match its schema: retrying cannot fix it. */
export class InvalidJobPayloadError extends DomainError {
  readonly issues: unknown;

  constructor(type: string, issues: unknown) {
    super("invalid_input", `Invalid payload for job ${type}`);
    this.issues = issues;
  }
}

/** A message on the queue is not a job envelope this app understands. */
export class InvalidJobEnvelopeError extends DomainError {
  readonly issues: unknown;

  constructor(issues: unknown) {
    super("invalid_input", "Malformed job envelope");
    this.issues = issues;
  }
}

/** No job with this type is registered in the job catalog. */
export class UnknownJobTypeError extends DomainError {
  constructor(type: string) {
    super("invalid_input", `Unknown job type ${type}`);
  }
}

/** Another delivery holds the job's idempotency key; this one waits and retries. */
export class JobLockedError extends DomainError {
  constructor(key: string) {
    super("conflict", `Job idempotency key ${key} is held by another run`);
  }
}
