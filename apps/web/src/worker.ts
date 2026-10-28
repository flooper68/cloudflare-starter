/**
 * Custom Worker entry: Astro handles HTTP; the queue consumer and Cron Triggers
 * run in the same Worker, so they share its bindings (D1, R2, secrets) and deploy
 * together with the code that produces their work.
 */
import { handle } from "@astrojs/cloudflare/handler";
import type { QueueMessage } from "@cloudflare-starter/features";

import { runScheduled } from "@/server/cron";
import type { AppEnv } from "@/server/env";
import { handleQueueBatch } from "@/server/queue";

export default {
  fetch: handle,

  async queue(batch, env) {
    await handleQueueBatch(batch, env);
  },

  async scheduled(controller, env) {
    await runScheduled(controller, env);
  },
} satisfies ExportedHandler<AppEnv, QueueMessage>;
