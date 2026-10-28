import type { JobEnvelope } from "@cloudflare-starter/features";

/**
 * Worker bindings and variables, read with `import { env } from "cloudflare:workers"`.
 * Secrets come from `apps/web/.dev.vars` locally and `wrangler secret put` when deployed;
 * their shape is validated by `parseAppConfig` in `src/lib/config.ts`.
 */
export interface AppEnv {
  readonly DB: D1Database;
  readonly FILES: R2Bucket;
  /** Producer of the job queue; `buildPlatform` fails naming it when it is missing. */
  readonly APP_QUEUE?: Queue<JobEnvelope>;
  /** version_metadata binding: the deployed version id is the `release` in logs and reports. */
  readonly CF_VERSION_METADATA?: WorkerVersionMetadata;
  /** Workers Rate Limiting, used by the edge policies of RATE_LIMIT_POLICIES. */
  readonly RL_AUTH_IP?: RateLimit;
  readonly RL_MUTATION?: RateLimit;
  readonly RL_MCP_IP?: RateLimit;
  readonly RL_MCP_USER?: RateLimit;
  readonly RL_UPLOAD?: RateLimit;
  readonly RL_INVITE?: RateLimit;
  readonly RL_TOKEN_LOOKUP?: RateLimit;
  readonly RL_UNSUBSCRIBE?: RateLimit;
  readonly APP_ENV?: string;
  /** Required var, validated by `parsePlatformConfig`: workers-logs | none. */
  readonly LOG_SINK?: string;
  /** Required var, validated by `parsePlatformConfig`: workers-logs | none. */
  readonly ERROR_REPORTER?: string;
  /** Required var, validated by `parsePlatformConfig`: d1 | none. */
  readonly FEATURE_FLAGS?: string;
  /** Required var, validated by `parsePlatformConfig`: analytics-engine | none. */
  readonly METRICS?: string;
  /** Required var, validated by `parsePlatformConfig`: workers | none. */
  readonly TRACING?: string;
  /** Analytics Engine dataset binding; required when METRICS=analytics-engine. */
  readonly METRICS_DATASET?: AnalyticsEngineDataset;
  readonly APP_URL?: string;
  readonly BETTER_AUTH_SECRET?: string;
  readonly GOOGLE_CLIENT_ID?: string;
  readonly GOOGLE_CLIENT_SECRET?: string;
  readonly [key: string]: unknown;
}
