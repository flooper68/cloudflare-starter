import {
  classifyJobFailure,
  createRequestContext,
  findJob,
  InvalidJobEnvelopeError,
  JOB_MAX_RETRIES,
  type JobCatalog,
  type JobDeps,
  jobCatalog,
  type LogFields,
  mathRandom,
  parseJobEnvelope,
  type Random,
  type RegisteredJob,
  randomIds,
  retryDelaySeconds,
  runJob,
  systemClock,
} from "@cloudflare-starter/features";

import { buildRequiredConfig } from "@/lib/env";
import { APP_NAME } from "@/server/auth";
import { getDb } from "@/server/db";
import type { AppEnv } from "@/server/env";
import { errorTypeOf, secondsSince } from "@/server/instrumentation";
import { loggerFor, type Platform, tracerFor } from "@/server/platform";

/** What the consumer needs besides the platform; tests pass their own catalog and random. */
export interface QueueDeps {
  readonly db: JobDeps["db"];
  readonly catalog: JobCatalog<JobDeps>;
  readonly random: Random;
  /** `max_retries` of the consumer in wrangler.jsonc. */
  readonly maxRetries: number;
  /** The app as mail sees it: name, APP_URL and BETTER_AUTH_SECRET (unsubscribe keys). */
  readonly app: JobDeps["app"];
}

/** The consumer's dependencies in the Worker: the real database, job catalog and settings. */
export function queueDeps(env: AppEnv): QueueDeps {
  const config = buildRequiredConfig(env);
  return {
    app: {
      name: APP_NAME,
      url: config.APP_URL.replace(/\/+$/, ""),
      secret: config.BETTER_AUTH_SECRET,
    },
    db: getDb(env),
    catalog: jobCatalog,
    random: mathRandom,
    maxRetries: JOB_MAX_RETRIES,
  };
}

/**
 * Consumes `APP_QUEUE`: every message is a job envelope (CloudEvents). Each runs with its own
 * request context, continuing the trace (traceparent) of the work that enqueued it, as its
 * user and workspace. Each message is acked or retried explicitly:
 * - success, or a duplicate of a done idempotency key: ack;
 * - a permanent failure (malformed envelope, unknown type, invalid payload, a DomainError of
 *   kind invalid_input, forbidden or not_found): reported, then acked, never retried;
 * - any other failure: logged (`job.retry`) and retried after the job's backoff;
 * - a failure on the final attempt (`max_retries` + 1): reported, then retried once more,
 *   which moves it to the dead-letter queue (no consumer; kept 14 days).
 * Each message is a consumer span (`process <queue>`) and one measurement of
 * `messaging.process.duration` by job type and outcome; the batch's metrics are flushed
 * when it is done.
 */
export async function handleQueueBatch(
  batch: MessageBatch<unknown>,
  platform: Platform,
  deps: QueueDeps
): Promise<void> {
  try {
    for (const message of batch.messages) {
      await handleMessage(message, batch.queue, platform, deps);
    }
  } finally {
    platform.metrics.flush();
  }
}

/** What happened to a job message (`app.job.outcome`, low cardinality). */
type JobOutcome =
  | "completed"
  | "skipped"
  | "retry"
  | "dead_lettered"
  | "discarded";

async function handleMessage(
  message: Message<unknown>,
  queue: string,
  platform: Platform,
  deps: QueueDeps
): Promise<void> {
  const messaging = {
    "messaging.system": "cloudflare_queues",
    "messaging.operation.name": "process",
    "messaging.destination.name": queue,
  } as const;
  platform.metrics
    .counter("messaging.client.consumed.messages")
    .add(1, messaging);
  const parsed = parseJobEnvelope(message.body);
  const envelope = parsed.ok ? parsed.envelope : undefined;
  const context = createRequestContext(
    { ids: randomIds },
    {
      source: "queue",
      release: platform.release,
      environment: platform.environment,
      // Validated by the envelope schema; a malformed message starts a new trace.
      traceparent: envelope?.traceparent ?? null,
      userId: envelope?.userid ?? null,
      workspaceId: envelope?.workspaceid ?? null,
    }
  );
  const fields: LogFields = {
    "messaging.system": "cloudflare_queues",
    "messaging.message.id": message.id,
    "app.job.attempts": message.attempts,
    ...(envelope
      ? {
          "cloudevents.event_id": envelope.id,
          "cloudevents.event_type": envelope.type,
          "cloudevents.event_source": envelope.source,
        }
      : {}),
  };
  const logger = loggerFor(platform, context).child(fields);
  const started = systemClock.now();
  const startedAt = started.getTime();
  let job: RegisteredJob<JobDeps> | undefined;
  let errorType: string | undefined;

  const outcome = await tracerFor(platform, context).startContextSpan(
    `process ${queue}`,
    {
      ...messaging,
      "messaging.message.id": message.id,
      "app.job.attempts": message.attempts,
      "cloudevents.event_id": envelope?.id,
      "cloudevents.event_type": envelope?.type,
    },
    async (span): Promise<JobOutcome> => {
      const result = await processMessage();
      span.setAttribute("app.job.outcome", result);
      span.setAttribute("error.type", errorType);
      if (result === "dead_lettered" || result === "discarded")
        span.setStatus({ code: "error" });
      return result;
    }
  );
  // Only a type from the job catalog is an attribute: bounded, unlike a malformed type.
  platform.metrics
    .histogram("messaging.process.duration")
    .record(secondsSince(systemClock, started), {
      ...messaging,
      "app.job.type": job?.type,
      "app.job.outcome": outcome,
      "error.type": errorType,
    });

  async function processMessage(): Promise<JobOutcome> {
    try {
      if (!parsed.ok) throw new InvalidJobEnvelopeError(parsed.issues);
      job = findJob(deps.catalog, parsed.envelope.type);
      const outcome = await runJob(
        {
          db: deps.db,
          clock: systemClock,
          ids: randomIds,
          logger,
          jobQueue: platform.jobQueue,
          email: platform.email,
          app: deps.app,
        },
        job,
        parsed.envelope,
        {
          id: parsed.envelope.id,
          type: parsed.envelope.type,
          time: parsed.envelope.time,
          attempts: message.attempts,
          context,
        }
      );
      logger.info(outcome === "skipped" ? "job.skipped" : "job.completed", {
        "app.job.duration_ms": systemClock.now().getTime() - startedAt,
      });
      message.ack();
      return outcome === "skipped" ? "skipped" : "completed";
    } catch (error) {
      errorType = errorTypeOf(error);
      const failure = classifyJobFailure(error, {
        attempts: message.attempts,
        maxRetries: deps.maxRetries,
      });
      const attributes: LogFields = {
        ...fields,
        "app.job.max_attempts": deps.maxRetries + 1,
        "app.job.duration_ms": systemClock.now().getTime() - startedAt,
      };
      // Only errors thrown by a found job are not permanent, so `job` is set here.
      if (failure === "retry" && job) {
        const delaySeconds = retryDelaySeconds(
          job.backoff,
          message.attempts,
          deps.random
        );
        logger.warn("job.retry", {
          ...attributes,
          error,
          "app.job.retry_delay_seconds": delaySeconds,
        });
        message.retry({ delaySeconds });
        return "retry";
      }
      // Reported once, here: a job that will not run again needs someone to look at it.
      platform.errors.capture(error, context, {
        ...attributes,
        "app.job.outcome": failure === "final" ? "dead_lettered" : "discarded",
      });
      if (failure === "final") {
        // Past max_retries, Queues moves the message to the dead-letter queue.
        message.retry();
        return "dead_lettered";
      }
      message.ack();
      return "discarded";
    }
  }
}
