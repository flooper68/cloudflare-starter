import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fixedClock } from "../../test/fixtures";
import { sendHello } from "./send-hello";

describe("sendHello (APP_QUEUE binding)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends the hello with the caller's request id to the real queue", async () => {
    // A spy that calls through: the message still goes to the local queue binding.
    const send = vi.spyOn(env.APP_QUEUE, "send");
    await sendHello(
      { queue: env.APP_QUEUE, clock: fixedClock() },
      { name: "Nicole", userId: "user-1", requestId: "req-42" }
    );
    expect(send).toHaveBeenCalledWith({
      type: "hello",
      name: "Nicole",
      userId: "user-1",
      queuedAt: "2026-10-28T12:00:00.000Z",
      requestId: "req-42",
    });
  });
});
