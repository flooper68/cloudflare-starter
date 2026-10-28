// Test entry for the API tests: the real queue and cron handlers, no Astro (tests call
// procedures, routes and handlers directly).
import type { QueueMessage } from "@cloudflare-starter/features";

import { runScheduled } from "@/server/cron";
import { getDb } from "@/server/db";
import type { AppEnv } from "@/server/env";
import { buildPlatform } from "@/server/platform";
import { handleQueueBatch } from "@/server/queue";

export default {
  fetch: () => new Response("web API tests"),
  queue: (batch, env) => handleQueueBatch(batch, buildPlatform(env)),
  scheduled: (controller, env) =>
    runScheduled(controller, buildPlatform(env), { db: getDb(env) }),
} satisfies ExportedHandler<AppEnv, QueueMessage>;
