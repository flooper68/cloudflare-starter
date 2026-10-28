import {
  helloGreeting,
  queueMessageSchema,
} from "@cloudflare-starter/features";

import type { AppEnv } from "@/server/env";

/**
 * Consumes `APP_QUEUE`: validates each message and hands it to its feature. A malformed
 * message is logged and dropped; a handler failure is retried with backoff and, after
 * `max_retries`, kept in the dead-letter queue.
 */
export async function handleQueueBatch(
  batch: MessageBatch<unknown>,
  env: Pick<AppEnv, "APP_ENV">
): Promise<void> {
  for (const message of batch.messages) {
    const parsed = queueMessageSchema.safeParse(message.body);
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
      switch (parsed.data.type) {
        case "hello":
          console.log(
            JSON.stringify(helloGreeting(parsed.data, env.APP_ENV ?? "develop"))
          );
          break;
      }
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
