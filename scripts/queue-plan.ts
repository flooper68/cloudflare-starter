/**
 * Which queues an environment of apps/web/wrangler.jsonc needs, and their settings that the
 * config file cannot hold. Used by `setup:cloudflare` and checked by
 * test/architecture/jobs.test.ts.
 */

/**
 * Message retention of every dead-letter queue: the Queues maximum on Workers Paid, 14 days
 * (the default is 4 days; Workers Free fixes retention at 24 hours). Nothing consumes a
 * dead-letter queue, so this is how long a failed job can be inspected and replayed.
 */
export const DLQ_MESSAGE_RETENTION_SECONDS = 1_209_600;

export interface QueueConsumerConfig {
  readonly queue: string;
  readonly dead_letter_queue?: string;
}

export interface PlannedQueue {
  readonly name: string;
  readonly role: "queue" | "dead-letter";
  /** Set with `--message-retention-period-secs`; undefined keeps Cloudflare's default. */
  readonly messageRetentionSeconds: number | undefined;
}

/** The queues of one environment block: each consumed queue, then its dead-letter queue. */
export function queuePlan(block: {
  readonly queues?: { readonly consumers?: readonly QueueConsumerConfig[] };
}): PlannedQueue[] {
  return (block.queues?.consumers ?? []).flatMap((consumer) => [
    {
      name: consumer.queue,
      role: "queue" as const,
      messageRetentionSeconds: undefined,
    },
    ...(consumer.dead_letter_queue
      ? [
          {
            name: consumer.dead_letter_queue,
            role: "dead-letter" as const,
            messageRetentionSeconds: DLQ_MESSAGE_RETENTION_SECONDS,
          },
        ]
      : []),
  ]);
}
