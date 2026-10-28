// The queue consumer against real D1 in workerd: message batches built with cloudflare:test,
// outcomes read back with getQueueResult, reports and logs through the memory adapters.
import {
  createExecutionContext,
  createMessageBatch,
  getQueueResult,
} from "cloudflare:test";
import { env } from "cloudflare:workers";
import {
  createJobCatalog,
  createMemoryErrorReporter,
  createMemoryJobQueue,
  createMemoryLogger,
  DomainError,
  defineJob,
  JOB_MAX_RETRIES,
  type JobDeps,
  type JobEnvelope,
  jobCatalog,
  registerJob,
} from "@cloudflare-starter/features";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { getDb } from "@/server/db";
import type { AppEnv } from "@/server/env";
import { buildPlatform, type Platform } from "@/server/platform";
import { handleQueueBatch, type QueueDeps } from "@/server/queue";

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const TRACEPARENT = `00-${TRACE_ID}-00f067aa0ba902b7-01`;

const flaky = defineJob({
  type: "test.flaky",
  payload: z.object({ step: z.string() }),
  backoff: { initialDelaySeconds: 30, maxDelaySeconds: 600, jitter: "equal" },
});
const strict = defineJob({
  type: "test.strict",
  payload: z.object({ invoiceId: z.string() }),
  backoff: { initialDelaySeconds: 30, maxDelaySeconds: 600, jitter: "none" },
  idempotencyKey: (payload) => payload.invoiceId,
});
const handled: string[] = [];
const catalog = createJobCatalog<JobDeps>([
  registerJob(flaky, async () => {
    throw new Error("payment provider down");
  }),
  registerJob(strict, async (_deps: JobDeps, payload) => {
    handled.push(payload.invoiceId);
    if (payload.invoiceId === "gone") {
      throw new DomainError("not_found", "Invoice not found");
    }
  }),
]);

function envelope(overrides: Partial<JobEnvelope> = {}): JobEnvelope {
  return {
    specversion: "1.0",
    id: "6f1c2d3e-0000-4000-8000-000000000001",
    source: "/develop/http",
    type: "greetings.hello",
    time: "2026-10-28T12:00:00.000Z",
    datacontenttype: "application/json",
    data: { name: "Nicole" },
    traceparent: TRACEPARENT,
    userid: "user-1",
    workspaceid: "ws-1",
    ...overrides,
  };
}

function setup(jobs = catalog) {
  const logger = createMemoryLogger();
  const errors = createMemoryErrorReporter();
  const jobQueue = createMemoryJobQueue();
  const platform: Platform = {
    ...buildPlatform(env as AppEnv),
    logger,
    errors,
    jobQueue,
  };
  const deps: QueueDeps = {
    db: getDb(env as AppEnv),
    catalog: jobs,
    random: { next: () => 0.5 },
    maxRetries: JOB_MAX_RETRIES,
  };
  return { platform, deps, logger, errors };
}

async function consume(
  messages: { id: string; body: unknown; attempts: number }[],
  { platform, deps }: ReturnType<typeof setup>
) {
  const batch = createMessageBatch("cloudflare-starter-develop", [
    ...messages.map((message) => ({ ...message, timestamp: Date.now() })),
  ]);
  // getQueueResult records which messages were retried, not their delays: spy for those.
  const retries = batch.messages.map((message) => vi.spyOn(message, "retry"));
  const ctx = createExecutionContext();
  await handleQueueBatch(batch, platform, deps);
  const result = await getQueueResult(batch, ctx);
  return {
    ...result,
    retryDelays: retries.flatMap((spy, index) =>
      spy.mock.calls.map(([options]) => ({
        msgId: batch.messages[index]?.id,
        delaySeconds: options?.delaySeconds,
      }))
    ),
  };
}

describe("queue consumer (handleQueueBatch)", () => {
  it("runs greetings.hello from the real catalog in the producer's trace, as its user, and acks it", async () => {
    const test = setup(jobCatalog);
    const result = await consume(
      [{ id: "m1", body: envelope(), attempts: 1 }],
      test
    );

    expect(result.explicitAcks).toEqual(["m1"]);
    expect(result.retryMessages).toEqual([]);
    const [hello, completed] = test.logger.records;
    expect(hello).toMatchObject({
      body: "greetings.hello",
      trace_id: TRACE_ID,
      attributes: {
        "app.request.source": "queue",
        "user.id": "user-1",
        "app.workspace.id": "ws-1",
        "messaging.system": "cloudflare_queues",
        "messaging.message.id": "m1",
        "cloudevents.event_id": "6f1c2d3e-0000-4000-8000-000000000001",
        "cloudevents.event_type": "greetings.hello",
        "app.job.attempts": 1,
        "app.greeting.message": "Hello, Nicole",
        "app.greeting.queued_at": "2026-10-28T12:00:00.000Z",
      },
    });
    // Its own span, a child of the producer's.
    expect(hello?.span_id).toMatch(/^[0-9a-f]{16}$/);
    expect(hello?.span_id).not.toBe("00f067aa0ba902b7");
    expect(completed).toMatchObject({ body: "job.completed" });
    expect(test.errors.captured).toEqual([]);
  });

  it("acks and reports a malformed message, in a new trace", async () => {
    const test = setup();
    const result = await consume(
      [
        {
          id: "m-bad",
          body: { type: "hello", name: "Nicole", traceparent: TRACEPARENT },
          attempts: 1,
        },
      ],
      test
    );

    expect(result.explicitAcks).toEqual(["m-bad"]);
    expect(result.retryMessages).toEqual([]);
    expect(test.errors.captured).toHaveLength(1);
    const [report] = test.errors.captured;
    expect(report?.error).toMatchObject({
      name: "InvalidJobEnvelopeError",
      kind: "invalid_input",
    });
    expect(report?.context.traceId).not.toBe(TRACE_ID);
    expect(report?.context.userId).toBeNull();
    expect(report?.extra).toMatchObject({ "app.job.outcome": "discarded" });
  });

  it("acks and reports an unknown job type and an invalid payload", async () => {
    const test = setup();
    const result = await consume(
      [
        { id: "m-unknown", body: envelope({ type: "test.gone" }), attempts: 1 },
        {
          id: "m-payload",
          body: envelope({ type: "test.flaky", data: { step: 1 } }),
          attempts: 1,
        },
      ],
      test
    );
    expect(result.explicitAcks).toEqual(["m-unknown", "m-payload"]);
    expect(test.errors.captured.map((r) => (r.error as Error).name)).toEqual([
      "UnknownJobTypeError",
      "InvalidJobPayloadError",
    ]);
  });

  it("retries a failing job after its backoff, without reporting it", async () => {
    const test = setup();
    const result = await consume(
      [
        {
          id: "m-1",
          body: envelope({ type: "test.flaky", data: { step: "a" } }),
          attempts: 1,
        },
        {
          id: "m-3",
          body: envelope({ type: "test.flaky", data: { step: "b" } }),
          attempts: 3,
        },
      ],
      test
    );

    // Equal jitter with random 0.5: 30 s → 23 s; 120 s → 90 s.
    expect(result.retryMessages).toEqual([{ msgId: "m-1" }, { msgId: "m-3" }]);
    expect(result.retryDelays).toEqual([
      { msgId: "m-1", delaySeconds: 23 },
      { msgId: "m-3", delaySeconds: 90 },
    ]);
    expect(result.explicitAcks).toEqual([]);
    expect(test.errors.captured).toEqual([]);
    expect(test.logger.records[0]).toMatchObject({
      severity_text: "WARN",
      body: "job.retry",
      trace_id: TRACE_ID,
      attributes: {
        "app.job.retry_delay_seconds": 23,
        "exception.message": "payment provider down",
      },
    });
  });

  it("reports the final attempt with the job's identity, then sends it to the dead-letter queue", async () => {
    const test = setup();
    const result = await consume(
      [
        {
          id: "m-last",
          body: envelope({ type: "test.flaky", data: { step: "c" } }),
          attempts: JOB_MAX_RETRIES + 1,
        },
      ],
      test
    );

    // Retried without a delay past max_retries: Queues moves it to the DLQ.
    expect(result.retryMessages).toEqual([{ msgId: "m-last" }]);
    expect(result.retryDelays).toEqual([
      { msgId: "m-last", delaySeconds: undefined },
    ]);
    expect(result.explicitAcks).toEqual([]);
    expect(test.errors.captured).toEqual([
      expect.objectContaining({
        reference: TRACE_ID,
        error: expect.objectContaining({ message: "payment provider down" }),
        context: expect.objectContaining({
          source: "queue",
          traceId: TRACE_ID,
          userId: "user-1",
          workspaceId: "ws-1",
        }),
        extra: expect.objectContaining({
          "cloudevents.event_id": "6f1c2d3e-0000-4000-8000-000000000001",
          "cloudevents.event_type": "test.flaky",
          "messaging.message.id": "m-last",
          "app.job.attempts": 6,
          "app.job.max_attempts": 6,
          "app.job.outcome": "dead_lettered",
        }),
      }),
    ]);
  });

  it("acks and reports a permanent DomainError instead of retrying it", async () => {
    const test = setup();
    const result = await consume(
      [
        {
          id: "m-gone",
          body: envelope({
            id: "job-gone",
            type: "test.strict",
            data: { invoiceId: "gone" },
            idempotencykey: "test.strict:gone",
          }),
          attempts: 1,
        },
      ],
      test
    );
    expect(result.explicitAcks).toEqual(["m-gone"]);
    expect(result.retryMessages).toEqual([]);
    expect(test.errors.captured).toEqual([
      expect.objectContaining({
        error: expect.objectContaining({ kind: "not_found" }),
        extra: expect.objectContaining({ "app.job.outcome": "discarded" }),
      }),
    ]);
  });

  it("skips a duplicate of a completed idempotency key", async () => {
    const test = setup();
    handled.length = 0;
    const result = await consume(
      [
        {
          id: "m-a",
          body: envelope({
            id: "job-a",
            type: "test.strict",
            data: { invoiceId: "inv-7" },
            idempotencykey: "test.strict:inv-7",
          }),
          attempts: 1,
        },
        {
          id: "m-b",
          body: envelope({
            id: "job-b",
            type: "test.strict",
            data: { invoiceId: "inv-7" },
            idempotencykey: "test.strict:inv-7",
          }),
          attempts: 1,
        },
      ],
      test
    );
    expect(result.explicitAcks).toEqual(["m-a", "m-b"]);
    expect(handled).toEqual(["inv-7"]);
    expect(test.logger.records.map((r) => r.body)).toEqual([
      "job.completed",
      "job.skipped",
    ]);
  });

  it("is the Worker's queue handler", async () => {
    const worker = (await import("../worker")).default;
    const send = vi.spyOn(console, "info").mockImplementation(() => {});
    const batch = createMessageBatch("cloudflare-starter-develop", [
      { id: "m-w", timestamp: Date.now(), attempts: 1, body: envelope() },
    ]);
    const ctx = createExecutionContext();
    await worker.queue(batch as MessageBatch<JobEnvelope>, env as AppEnv);
    expect((await getQueueResult(batch, ctx)).explicitAcks).toEqual(["m-w"]);
    send.mockRestore();
  });
});
