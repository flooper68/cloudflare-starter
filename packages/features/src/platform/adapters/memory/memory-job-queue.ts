import type { JobEnvelope } from "../../../kernel";
import { assertJobDelay } from "../../job-delay";
import type { JobQueue } from "../../ports";

export interface SentJob {
  readonly envelope: JobEnvelope;
  readonly delaySeconds: number | undefined;
}

/** A job queue that keeps what was sent in memory. */
export interface MemoryJobQueue extends JobQueue {
  readonly sent: readonly SentJob[];
}

/** JobQueue for tests: assert on `sent` instead of spying on a binding. */
export function createMemoryJobQueue(): MemoryJobQueue {
  const sent: SentJob[] = [];
  return {
    sent,
    async send(envelope, options = {}) {
      assertJobDelay(options.delaySeconds);
      sent.push({ envelope, delaySeconds: options.delaySeconds });
    },
  };
}
