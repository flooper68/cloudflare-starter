/**
 * Custom Worker entry: Astro handles HTTP; the queue consumer and Cron Triggers
 * run in the same Worker, so they share its bindings (D1, R2, secrets) and deploy
 * together with the code that produces their work.
 */
import { handle } from "@astrojs/cloudflare/handler";
import type { JobEnvelope } from "@cloudflare-starter/features";

import { runScheduled } from "@/server/cron";
import type { AppEnv } from "@/server/env";
import { buildPlatform } from "@/server/platform";
import { handleQueueBatch, queueDeps } from "@/server/queue";

export default {
  fetch: handle,

  async queue(batch, env) {
    await handleQueueBatch(batch, buildPlatform(env), queueDeps(env));
  },

  async scheduled(controller, env) {
    await runScheduled(controller, buildPlatform(env));
  },
} satisfies ExportedHandler<AppEnv, JobEnvelope>;
