/**
 * Custom Worker entry: Astro handles HTTP; the queue consumer, Cron Triggers and the
 * container demo's Workflow (ContainerRunWorkflow) run in the same Worker, so they share its bindings (D1, R2, secrets) and deploy
 * together with the code that produces their work.
 */
import { handle } from "@astrojs/cloudflare/handler";
import type { JobEnvelope } from "@cloudflare-starter/features";
import { ContainerRunWorkflow } from "@/server/container-run-workflow";
import { runScheduled } from "@/server/cron";
import type { AppEnv } from "@/server/env";
import { buildPlatform } from "@/server/platform";
import { handleQueueBatch, queueDeps } from "@/server/queue";

// The container workflow demo's Workflow class (the CONTAINER_RUN_WORKFLOW binding).
export { ContainerRunWorkflow };

export default {
  fetch: handle,

  async queue(batch, env) {
    await handleQueueBatch(batch, buildPlatform(env), queueDeps(env));
  },

  async scheduled(controller, env) {
    await runScheduled(controller, buildPlatform(env));
  },
} satisfies ExportedHandler<AppEnv, JobEnvelope>;
