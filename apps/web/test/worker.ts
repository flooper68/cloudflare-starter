// Test entry for the API tests: the real queue and cron handlers, no Astro (tests call
// procedures, routes and handlers directly).
import type { JobEnvelope } from "@cloudflare-starter/features";

import { runScheduled } from "@/server/cron";
import type { AppEnv } from "@/server/env";
import { buildPlatform } from "@/server/platform";
import { handleQueueBatch, queueDeps } from "@/server/queue";

export default {
  fetch: () => new Response("web API tests"),
  queue: (batch, env) =>
    handleQueueBatch(batch, buildPlatform(env), queueDeps(env)),
  scheduled: (controller, env) => runScheduled(controller, buildPlatform(env)),
} satisfies ExportedHandler<AppEnv, JobEnvelope>;
