import { describe, expect, it, vi } from "vitest";

import type { HelloMessage } from "./domain";
import { sendHello } from "./send-hello";

describe("sendHello", () => {
  it("queues a valid hello stamped with the clock", async () => {
    const queue = { send: vi.fn().mockResolvedValue(undefined) };
    await sendHello(
      {
        queue: queue as unknown as Queue<HelloMessage>,
        clock: { now: () => new Date("2026-10-28T12:00:00.000Z") },
      },
      { name: "Nicole", userId: "user-1" }
    );
    expect(queue.send).toHaveBeenCalledWith({
      type: "hello",
      name: "Nicole",
      userId: "user-1",
      queuedAt: "2026-10-28T12:00:00.000Z",
    });
  });

  it("carries the caller's request id for the consumer", async () => {
    const queue = { send: vi.fn().mockResolvedValue(undefined) };
    await sendHello(
      {
        queue: queue as unknown as Queue<HelloMessage>,
        clock: { now: () => new Date("2026-10-28T12:00:00.000Z") },
      },
      { name: "Nicole", userId: "user-1", requestId: "req-1" }
    );
    expect(queue.send).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "req-1" })
    );
  });

  it("refuses an invalid message before it reaches the queue", async () => {
    const queue = { send: vi.fn() };
    await expect(
      sendHello(
        {
          queue: queue as unknown as Queue<HelloMessage>,
          clock: { now: () => new Date() },
        },
        { name: "", userId: "user-1" }
      )
    ).rejects.toThrow();
    expect(queue.send).not.toHaveBeenCalled();
  });
});
