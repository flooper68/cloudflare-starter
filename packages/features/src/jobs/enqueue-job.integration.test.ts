import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { fixedClock, sequentialIds } from "../../test/fixtures";
import { defineJob, type RequestContext } from "../kernel";
import { createCloudflareJobQueue } from "../platform";
import { InvalidJobPayloadError } from "./domain";
import { enqueueJob } from "./enqueue-job";

const context: RequestContext = {
  traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
  spanId: "00f067aa0ba902b7",
  parentSpanId: null,
  traceFlags: "01",
  source: "http",
  userId: "user-1",
  workspaceId: "ws-1",
  ip: "203.0.113.7",
  release: "local",
  environment: "develop",
};
const invoiceJob = defineJob({
  type: "billing.send-invoice",
  payload: z.object({ invoiceId: z.string().min(1) }),
  backoff: { initialDelaySeconds: 30, maxDelaySeconds: 3600, jitter: "full" },
  idempotencyKey: (payload) => payload.invoiceId,
});

describe("enqueueJob (APP_QUEUE binding)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends a CloudEvents envelope with the caller's trace, user and workspace", async () => {
    // A spy that calls through: the envelope still goes to the local queue.
    const send = vi.spyOn(env.APP_QUEUE, "send");
    const { id } = await enqueueJob(
      {
        jobQueue: createCloudflareJobQueue(env.APP_QUEUE),
        clock: fixedClock(),
        ids: sequentialIds(),
      },
      invoiceJob,
      { invoiceId: "inv-42" },
      { context, delaySeconds: 5 }
    );

    expect(id).toBe("00000000-0000-4000-8000-000000000001");
    expect(send).toHaveBeenCalledWith(
      {
        specversion: "1.0",
        id,
        source: "/develop/http",
        type: "billing.send-invoice",
        time: "2026-10-28T12:00:00.000Z",
        datacontenttype: "application/json",
        data: { invoiceId: "inv-42" },
        traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
        idempotencykey: "billing.send-invoice:inv-42",
        userid: "user-1",
        workspaceid: "ws-1",
      },
      { contentType: "json", delaySeconds: 5 }
    );
    // Never the IP: it is personal data and stays at the HTTP edge.
    expect(JSON.stringify(send.mock.calls)).not.toContain("203.0.113.7");
  });

  it("leaves out the user, workspace and key when there are none", async () => {
    const send = vi.spyOn(env.APP_QUEUE, "send");
    await enqueueJob(
      {
        jobQueue: createCloudflareJobQueue(env.APP_QUEUE),
        clock: fixedClock(),
        ids: sequentialIds(),
      },
      defineJob({ ...invoiceJob, idempotencyKey: undefined }),
      { invoiceId: "inv-1" },
      {
        context: {
          ...context,
          userId: null,
          workspaceId: null,
          source: "cron",
        },
      }
    );
    const [envelope, options] = send.mock.calls[0] ?? [];
    expect(envelope).not.toHaveProperty("userid");
    expect(envelope).not.toHaveProperty("workspaceid");
    expect(envelope).not.toHaveProperty("idempotencykey");
    expect(envelope).toMatchObject({ source: "/develop/cron" });
    expect(options).toEqual({ contentType: "json" });
  });

  it("refuses an invalid payload before it reaches the queue", async () => {
    const send = vi.spyOn(env.APP_QUEUE, "send");
    await expect(
      enqueueJob(
        {
          jobQueue: createCloudflareJobQueue(env.APP_QUEUE),
          clock: fixedClock(),
          ids: sequentialIds(),
        },
        invoiceJob,
        { invoiceId: "" },
        { context }
      )
    ).rejects.toBeInstanceOf(InvalidJobPayloadError);
    expect(send).not.toHaveBeenCalled();
  });
});
