import { DomainError, type DomainErrorKind } from "../../kernel";

/**
 * `max_retries` of every queue consumer in apps/web/wrangler.jsonc (an architecture test
 * keeps them equal): a job is attempted at most `JOB_MAX_RETRIES + 1` times, then it goes
 * to the dead-letter queue.
 */
export const JOB_MAX_RETRIES = 5;

/** Domain error kinds that no retry can fix: the job is acked and reported. */
export const PERMANENT_ERROR_KINDS: readonly DomainErrorKind[] = [
  "invalid_input",
  "forbidden",
  "not_found",
];

/**
 * What to do with a job whose attempt failed:
 * - `permanent`: a DomainError of a permanent kind; ack it (no retry) and report it;
 * - `final`: the last attempt failed; report it, then let it go to the dead-letter queue;
 * - `retry`: retry it after the job's backoff.
 */
export type JobFailure = "permanent" | "final" | "retry";

export function classifyJobFailure(
  error: unknown,
  delivery: { readonly attempts: number; readonly maxRetries: number }
): JobFailure {
  if (
    error instanceof DomainError &&
    PERMANENT_ERROR_KINDS.includes(error.kind)
  )
    return "permanent";
  return delivery.attempts >= delivery.maxRetries + 1 ? "final" : "retry";
}
