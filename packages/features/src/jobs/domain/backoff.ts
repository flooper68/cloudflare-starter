import type { JobBackoff, Random } from "../../kernel";

/** The Queues limit for a retry delay: 24 hours. */
const MAX_DELAY_SECONDS = 86_400;

/**
 * Seconds to wait before the next attempt after attempt number `attempts` (1-based, as
 * Queues counts) failed: `initialDelaySeconds * 2^(attempts - 1)`, capped at
 * `maxDelaySeconds` and 24 hours, then jittered. Always a whole number of at least 1, as
 * `message.retry({ delaySeconds })` requires.
 */
export function retryDelaySeconds(
  backoff: JobBackoff,
  attempts: number,
  random: Random
): number {
  const exponent = Math.max(0, attempts - 1);
  const capped = Math.min(
    backoff.initialDelaySeconds * 2 ** exponent,
    backoff.maxDelaySeconds,
    MAX_DELAY_SECONDS
  );
  const jittered =
    backoff.jitter === "full"
      ? random.next() * capped
      : backoff.jitter === "equal"
        ? capped / 2 + (random.next() * capped) / 2
        : capped;
  return Math.min(MAX_DELAY_SECONDS, Math.max(1, Math.ceil(jittered)));
}
