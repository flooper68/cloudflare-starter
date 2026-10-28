import {
  createRequestContext,
  helloGreeting,
  queueMessageSchema,
  randomIds,
} from "@cloudflare-starter/features";

import { loggerFor, type Platform } from "@/server/platform";

/**
 * Consumes `APP_QUEUE`: validates each message and hands it to its feature. Each message
 * runs with its own request context, continuing the trace (traceparent) of the request that queued it.
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
        // Validated by the message schema; a malformed message starts a new trace.
        traceparent: parsed.success ? (parsed.data.traceparent ?? null) : null,
        userId: parsed.success ? parsed.data.userId : null,
      }
    );
    const logger = loggerFor(platform, context).child({
      "messaging.system": "cloudflare_queues",
      "messaging.message.id": message.id,
      "app.queue.attempts": message.attempts,
    });

    if (!parsed.success) {
      // A malformed message never succeeds; retrying it would only delay the dead-letter queue.
      logger.warn("queue.invalid", { "app.queue.issues": parsed.error.issues });
      message.ack();
      continue;
    }

    try {
      switch (parsed.data.type) {
        case "hello":
          logger.info("queue.hello", helloGreeting(parsed.data));
          break;
      }
      message.ack();
    } catch (error) {
      platform.errors.capture(error, context, {
        "messaging.system": "cloudflare_queues",
        "messaging.message.id": message.id,
        "app.queue.attempts": message.attempts,
        "app.queue.message_type": parsed.data.type,
      });
      message.retry({ delaySeconds: 30 * message.attempts });
    }
  }
}
