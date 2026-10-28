import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fixedClock, sequentialIds } from "../../test/fixtures";
import { InvalidJobPayloadError } from "../jobs";
import { createCloudflareJobQueue, createRequestContext } from "../platform";
import { sendHello } from "./send-hello";

const context = createRequestContext(
  { ids: sequentialIds() },
  {
    source: "http",
    release: "local",
    environment: "develop",
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    userId: "user-1",
  }
);

describe("sendHello (APP_QUEUE binding)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("enqueues a greetings.hello job in the caller's trace, as the caller", async () => {
    // A spy that calls through: the job still goes to the local queue binding.
    const send = vi.spyOn(env.APP_QUEUE, "send");
    const { id } = await sendHello(
      {
        jobQueue: createCloudflareJobQueue(env.APP_QUEUE),
        clock: fixedClock(),
        ids: sequentialIds("11111111-0000-4000-8000-"),
      },
      { name: "Nicole" },
      { context }
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        id,
        type: "greetings.hello",
        data: { name: "Nicole" },
        time: "2026-10-28T12:00:00.000Z",
        userid: "user-1",
        traceparent: `00-4bf92f3577b34da6a3ce929d0e0e4736-${context.spanId}-01`,
      }),
      { contentType: "json" }
    );
  });

  it("refuses an empty name before it reaches the queue", async () => {
    const send = vi.spyOn(env.APP_QUEUE, "send");
    await expect(
      sendHello(
        {
          jobQueue: createCloudflareJobQueue(env.APP_QUEUE),
          clock: fixedClock(),
          ids: sequentialIds(),
        },
        { name: "  " },
        { context }
      )
    ).rejects.toBeInstanceOf(InvalidJobPayloadError);
    expect(send).not.toHaveBeenCalled();
  });
});
