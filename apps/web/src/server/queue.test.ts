import {
  createMemoryErrorReporter,
  createMemoryLogger,
  type Logger,
} from "@cloudflare-starter/features";
import { describe, expect, it, vi } from "vitest";

import type { Platform } from "./platform";
import { handleQueueBatch } from "./queue";

function message(body: unknown, id = "m1") {
  return { id, attempts: 1, body, ack: vi.fn(), retry: vi.fn() };
}

function memoryPlatform(logger: Logger = createMemoryLogger()) {
  const errors = createMemoryErrorReporter();
  const platform: Platform = {
    logger,
    errors,
    release: "v-test",
    environment: "local",
  };
  return { platform, errors };
}

const TRACEPARENT = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
const hello = {
  type: "hello",
  name: "Nicole",
  userId: "user-1",
  queuedAt: "2026-04-20T12:00:00.000Z",
};

describe("queue consumer", () => {
  it("continues the producer's trace for a valid message, and acks it", async () => {
    const logger = createMemoryLogger();
    const { platform, errors } = memoryPlatform(logger);
    const ok = message({ ...hello, traceparent: TRACEPARENT });

    await handleQueueBatch(
      { messages: [ok] } as unknown as MessageBatch<unknown>,
      platform
    );

    expect(ok.ack).toHaveBeenCalled();
    expect(logger.records).toHaveLength(1);
    const [record] = logger.records;
    expect(record).toMatchObject({
      severity_text: "INFO",
      body: "queue.hello",
      trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
      attributes: {
        "app.request.source": "queue",
        "user.id": "user-1",
        "messaging.system": "cloudflare_queues",
        "messaging.message.id": "m1",
        "app.queue.attempts": 1,
        "app.greeting.message": "Hello, Nicole",
      },
    });
    // Its own span, child of the producer's.
    expect(record?.span_id).toMatch(/^[0-9a-f]{16}$/);
    expect(record?.span_id).not.toBe("00f067aa0ba902b7");
    expect(errors.captured).toEqual([]);
  });

  it("drops a malformed message with a warning and a new trace", async () => {
    const logger = createMemoryLogger();
    const { platform, errors } = memoryPlatform(logger);
    const bad = message({ type: "nope", traceparent: TRACEPARENT });

    await handleQueueBatch(
      { messages: [bad] } as unknown as MessageBatch<unknown>,
      platform
    );

    expect(bad.ack).toHaveBeenCalled();
    expect(bad.retry).not.toHaveBeenCalled();
    expect(logger.records).toEqual([
      expect.objectContaining({
        severity_text: "WARN",
        body: "queue.invalid",
        trace_id: expect.stringMatching(/^[0-9a-f]{32}$/),
      }),
    ]);
    expect(logger.records[0]?.trace_id).not.toBe(
      "4bf92f3577b34da6a3ce929d0e0e4736"
    );
    expect(logger.records[0]?.attributes).not.toHaveProperty("user.id");
    expect(errors.captured).toEqual([]);
  });

  it("reports a failing handler with the message's context and retries it", async () => {
    const throwing: Logger = {
      ...createMemoryLogger(),
      info: () => {
        throw new Error("sink down");
      },
      child: () => throwing,
      withContext: () => throwing,
    };
    const { platform, errors } = memoryPlatform(throwing);
    const msg = message({ ...hello, traceparent: TRACEPARENT });

    await handleQueueBatch(
      { messages: [msg] } as unknown as MessageBatch<unknown>,
      platform
    );

    expect(msg.ack).not.toHaveBeenCalled();
    expect(msg.retry).toHaveBeenCalledWith({ delaySeconds: 30 });
    expect(errors.captured).toEqual([
      expect.objectContaining({
        reference: "4bf92f3577b34da6a3ce929d0e0e4736",
        context: expect.objectContaining({ source: "queue", userId: "user-1" }),
        extra: {
          "messaging.system": "cloudflare_queues",
          "messaging.message.id": "m1",
          "app.queue.attempts": 1,
          "app.queue.message_type": "hello",
        },
      }),
    ]);
  });
});
