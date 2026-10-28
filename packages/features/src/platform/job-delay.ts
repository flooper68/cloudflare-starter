/** The Queues limit for send and retry delays: 24 hours. */
export const MAX_JOB_DELAY_SECONDS = 86_400;

/** Throws the RangeError every JobQueue adapter raises for a delay the queue cannot take. */
export function assertJobDelay(delaySeconds: number | undefined): void {
  if (delaySeconds === undefined) return;
  if (
    !Number.isInteger(delaySeconds) ||
    delaySeconds < 0 ||
    delaySeconds > MAX_JOB_DELAY_SECONDS
  ) {
    throw new RangeError(
      `delaySeconds must be an integer from 0 to ${MAX_JOB_DELAY_SECONDS}, got ${delaySeconds}`
    );
  }
}
