import type { JobEnvelope } from "../../../kernel";
import { assertJobDelay } from "../../job-delay";
import type { JobQueue } from "../../ports";

/**
 * JobQueue over a Cloudflare Queues producer binding (`APP_QUEUE`). The envelope is sent
 * as JSON, so the dashboard and `wrangler queues` show it readably in the dead-letter queue.
 * The only code besides the jobs feature allowed to call `.send(` on a queue
 * (lint/rules/no-direct-queue-send.grit).
 */
export function createCloudflareJobQueue(queue: Queue<JobEnvelope>): JobQueue {
  return {
    async send(envelope, options = {}) {
      assertJobDelay(options.delaySeconds);
      await queue.send(envelope, {
        contentType: "json",
        ...(options.delaySeconds === undefined
          ? {}
          : { delaySeconds: options.delaySeconds }),
      });
    },
  };
}
