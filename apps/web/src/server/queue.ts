import {
  createRequestContext,
  helloGreeting,
  queueMessageSchema,
  randomIds,
} from "@cloudflare-starter/features";

import { loggerFor, type Platform } from "@/server/platform";

/**
 * Consumes `APP_QUEUE`: validates each message and hands it to its feature. Each message
 * runs with its own request context, reusing the request id of the request that queued it.
 * A malformed message is logged and dropped; a handler failure is reported and retried
 * with backoff and, after `max_retries`, kept in the dead-letter queue.
 */
export async function handleQueueBatch(
  batch: MessageBatch<unknown>,
  platform: Platform
): Promise<void> {
  for (const message of batch.messages) {
    const parsed = queueMessageSchema.safeParse(message.body);
    const context = createRequestContext(
      { ids: randomIds },
      {
        source: "queue",
        release: platform.release,
        environment: platform.environment,
        // Validated by the message schema; a malformed message gets a fresh id.
        requestId: parsed.success ? (parsed.data.requestId ?? null) : null,
        userId: parsed.success ? parsed.data.userId : null,
      }
    );
    const logger = loggerFor(platform, context).child({
      messageId: message.id,
      attempts: message.attempts,
    });

    if (!parsed.success) {
      // A malformed message never succeeds; retrying it would only delay the dead-letter queue.
      logger.warn("queue.invalid", { issues: parsed.error.issues });
      message.ack();
      continue;
    }

    try {
      switch (parsed.data.type) {
        case "hello":
          logger.info(
            "queue.hello",
            helloGreeting(parsed.data, platform.environment)
          );
          break;
      }
      message.ack();
    } catch (error) {
      platform.errors.capture(error, context, {
        messageId: message.id,
        attempts: message.attempts,
        type: parsed.data.type,
      });
      message.retry({ delaySeconds: 30 * message.attempts });
    }
  }
}
