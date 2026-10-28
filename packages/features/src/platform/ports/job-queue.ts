import type { JobEnvelope } from "../../kernel";

export interface JobQueueSendOptions {
  /** Seconds before the job becomes visible to the consumer: an integer, 0 to 86400. */
  readonly delaySeconds?: number;
}

/**
 * Port: puts a job envelope on the background queue. Features never call it directly:
 * `enqueueJob` (packages/features/src/jobs) validates the payload and builds the envelope
 * first. Rejects a `delaySeconds` outside 0..86400 or not an integer with a RangeError,
 * before anything is sent. Implementations pass `describeJobQueueContract`
 * (job-queue.contract.ts).
 *
 * There is deliberately no noop adapter: a queue that silently drops jobs loses work
 * without a trace. Environments without a queue fail loudly instead.
 */
export interface JobQueue {
  send(envelope: JobEnvelope, options?: JobQueueSendOptions): Promise<void>;
}
