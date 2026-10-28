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

const hello = {
  type: "hello",
  name: "Nicole",
  userId: "user-1",
  queuedAt: "2026-04-20T12:00:00.000Z",
};

describe("queue consumer", () => {
  it("logs a valid message under the request id that queued it, and acks it", async () => {
    const logger = createMemoryLogger();
    const { platform, errors } = memoryPlatform(logger);
    const ok = message({ ...hello, requestId: "req-from-web" });

    await handleQueueBatch(
      { messages: [ok] } as unknown as MessageBatch<unknown>,
      platform
    );

    expect(ok.ack).toHaveBeenCalled();
    expect(logger.records).toEqual([
      expect.objectContaining({
        level: "info",
        event: "queue.hello",
        requestId: "req-from-web",
        source: "queue",
        userId: "user-1",
        release: "v-test",
        messageId: "m1",
        message: "Hello, Nicole",
      }),
    ]);
    expect(errors.captured).toEqual([]);
  });

  it("drops a malformed message with a warning and a fresh request id", async () => {
    const logger = createMemoryLogger();
    const { platform, errors } = memoryPlatform(logger);
    const bad = message({ type: "nope" });

    await handleQueueBatch(
      { messages: [bad] } as unknown as MessageBatch<unknown>,
      platform
    );

    expect(bad.ack).toHaveBeenCalled();
    expect(bad.retry).not.toHaveBeenCalled();
    expect(logger.records).toEqual([
      expect.objectContaining({
        level: "warn",
        event: "queue.invalid",
        requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        userId: null,
      }),
    ]);
    expect(errors.captured).toEqual([]);
  });

  it("reports a failing handler with the message's context and retries it", async () => {
    const throwing: Logger = {
      ...createMemoryLogger(),
      info: () => {
        throw new Error("sink down");
      },
      child: () => throwing,
    };
    const { platform, errors } = memoryPlatform(throwing);
    const msg = message({ ...hello, requestId: "req-7" });

    await handleQueueBatch(
      { messages: [msg] } as unknown as MessageBatch<unknown>,
      platform
    );

    expect(msg.ack).not.toHaveBeenCalled();
    expect(msg.retry).toHaveBeenCalledWith({ delaySeconds: 30 });
    expect(errors.captured).toEqual([
      expect.objectContaining({
        reference: "req-7",
        context: expect.objectContaining({ source: "queue", userId: "user-1" }),
        extra: { messageId: "m1", attempts: 1, type: "hello" },
      }),
    ]);
  });
});
