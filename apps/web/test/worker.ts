// Test entry for the API tests: the real queue and cron handlers and the
// container run Workflow, no Astro (tests call
// procedures, routes and handlers directly).
import type { JobEnvelope } from "@cloudflare-starter/features";

import { ContainerRunWorkflow } from "@/server/container-run-workflow";
import { runScheduled } from "@/server/cron";
import type { AppEnv } from "@/server/env";
import { buildPlatform } from "@/server/platform";
import { handleQueueBatch, queueDeps } from "@/server/queue";

// The container workflow demo's Workflow, bound as CONTAINER_RUN_WORKFLOW (wrangler.jsonc).
export { ContainerRunWorkflow };

export default {
  fetch: () => new Response("web API tests"),
  queue: (batch, env) =>
    handleQueueBatch(batch, buildPlatform(env), queueDeps(env)),
  scheduled: (controller, env) => runScheduled(controller, buildPlatform(env)),
} satisfies ExportedHandler<AppEnv, JobEnvelope>;
