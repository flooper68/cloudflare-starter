import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fixedClock } from "../../test/fixtures";
import { sendHello } from "./send-hello";

describe("sendHello (APP_QUEUE binding)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends the hello with the caller's traceparent to the real queue", async () => {
    // A spy that calls through: the message still goes to the local queue binding.
    const send = vi.spyOn(env.APP_QUEUE, "send");
    await sendHello(
      { queue: env.APP_QUEUE, clock: fixedClock() },
      {
        name: "Nicole",
        userId: "user-1",
        traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      }
    );
    expect(send).toHaveBeenCalledWith({
      type: "hello",
      name: "Nicole",
      userId: "user-1",
      queuedAt: "2026-10-28T12:00:00.000Z",
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    });
  });
});
