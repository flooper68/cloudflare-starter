// Runs in workerd (features-integration) against the local APP_QUEUE producer binding: the
// spy calls through, so every envelope really goes to Miniflare's queue.
import { env } from "cloudflare:workers";
import { vi } from "vitest";

import { describeJobQueueContract } from "../../ports/job-queue.contract";
import { createCloudflareJobQueue } from "./cloudflare-job-queue";

describeJobQueueContract("createCloudflareJobQueue", () => {
  const send = vi.spyOn(env.APP_QUEUE, "send");
  return {
    queue: createCloudflareJobQueue(env.APP_QUEUE),
    sent: () =>
      send.mock.calls.map(([envelope, options]) => {
        // JSON on the wire, so the dead-letter queue shows readable messages.
        if (options?.contentType !== "json") {
          throw new Error(`sent as ${options?.contentType}, expected json`);
        }
        return { envelope, delaySeconds: options.delaySeconds };
      }),
    dispose: () => send.mockRestore(),
  };
});
