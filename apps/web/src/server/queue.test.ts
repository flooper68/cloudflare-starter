import { describe, expect, it, vi } from "vitest";

import { handleQueueBatch } from "./queue";

function message(body: unknown) {
  return {
    id: "m1",
    attempts: 1,
    body,
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

describe("queue consumer", () => {
  it("acks valid messages and drops malformed ones", async () => {
    const ok = message({
      type: "hello",
      name: "Nicole",
      userId: "user-1",
      queuedAt: "2026-04-20T12:00:00.000Z",
    });
    const bad = message({ type: "nope" });
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await handleQueueBatch(
      { messages: [ok, bad] } as unknown as MessageBatch<unknown>,
      { APP_ENV: "local" }
    );

    expect(ok.ack).toHaveBeenCalled();
    expect(bad.ack).toHaveBeenCalled();
    expect(bad.retry).not.toHaveBeenCalled();
  });
});
