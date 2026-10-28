import { appQueueMessageSchema } from "@cloudflare-starter/features";

import type { AppEnv } from "@/server/env";

/**
 * Consumes `APP_QUEUE`. Each message is validated, handled and acked on its own.
 * A malformed message is logged and dropped; a handler failure is retried with backoff
 * and, after `max_retries`, kept in the dead-letter queue.
 */
export async function handleQueueBatch(
  batch: MessageBatch<unknown>,
  env: Pick<AppEnv, "APP_ENV">
): Promise<void> {
  for (const message of batch.messages) {
    const parsed = appQueueMessageSchema.safeParse(message.body);
    if (!parsed.success) {
      // A malformed message never succeeds; retrying it would only delay the dead-letter queue.
      console.error(
        JSON.stringify({
          tag: "queue-invalid",
          id: message.id,
          issues: parsed.error.issues,
        })
      );
      message.ack();
      continue;
    }

    try {
      const payload = parsed.data;
      console.log(
        JSON.stringify({
          tag: "queue-hello",
          environment: env.APP_ENV ?? "develop",
          message: `Hello, ${payload.name}`,
          userId: payload.userId,
          queuedAt: payload.queuedAt,
        })
      );
      message.ack();
    } catch (error) {
      console.error(
        JSON.stringify({
          tag: "queue-failed",
          id: message.id,
          attempts: message.attempts,
          error: error instanceof Error ? error.message : "unknown",
        })
      );
      message.retry({ delaySeconds: 30 * message.attempts });
    }
  }
}
