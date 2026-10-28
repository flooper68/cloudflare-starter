import { createDb, type Database } from "@cloudflare-starter/features";

import type { AppEnv } from "@/server/env";

/** Per-isolate cache: the `env` from `cloudflare:workers` is stable for the isolate's lifetime. */
let cache: { readonly d1: D1Database; readonly db: Database } | undefined;

export function getDb(env: Pick<AppEnv, "DB">): Database {
  if (!cache || cache.d1 !== env.DB) {
    cache = { d1: env.DB, db: createDb(env.DB) };
  }
  return cache.db;
}
