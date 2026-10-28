import type { AppQueueMessage } from "@cloudflare-starter/features";

/**
 * Worker bindings and variables, read with `import { env } from "cloudflare:workers"`.
 * Secrets come from `apps/web/.dev.vars` locally and `wrangler secret put` when deployed;
 * their shape is validated by `parseAppConfig` in `src/lib/config.ts`.
 */
export interface AppEnv {
  readonly DB: D1Database;
  readonly FILES: R2Bucket;
  readonly APP_QUEUE?: Queue<AppQueueMessage>;
  readonly APP_ENV?: string;
  readonly APP_URL?: string;
  readonly BETTER_AUTH_SECRET?: string;
  readonly GOOGLE_CLIENT_ID?: string;
  readonly GOOGLE_CLIENT_SECRET?: string;
  readonly [key: string]: unknown;
}
