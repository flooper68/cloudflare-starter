/**
 * Composition root of the platform ports: picks one adapter per port from explicit settings
 * (LOG_SINK, ERROR_REPORTER, FEATURE_FLAGS) and builds it once per isolate. JobQueue has one
 * adapter, the APP_QUEUE binding, and no setting: it has no "off" (dropping jobs silently is
 * unsafe). Adding a vendor means a new
 * adapter in packages/features/src/platform/adapters/<vendor>/, a new allowed value in
 * src/lib/config.ts and a branch here (docs/architecture/overview.md#ports-and-adapters).
 */
import {
  createCloudflareJobQueue,
  createD1FeatureFlags,
  createWorkersLogsErrorReporter,
  createWorkersLogsLogger,
  type ErrorReporter,
  type FeatureFlagStore,
  type FeatureFlags,
  type JobQueue,
  type Logger,
  type LogResource,
  noopErrorReporter,
  noopFeatureFlags,
  noopLogger,
  type RequestContext,
  systemClock,
} from "@cloudflare-starter/features";

import { ConfigError, parsePlatformConfig } from "@/lib/config";
import { buildRawEnv } from "@/lib/env";
import type { AppEnv } from "@/server/env";

/**
 * OpenTelemetry `service.name` of this Worker. Keep it equal to `name` in wrangler.jsonc
 * (rename both when a project renames the Worker).
 */
export const SERVICE_NAME = "cloudflare-starter-web";

export interface Platform {
  readonly logger: Logger;
  readonly errors: ErrorReporter;
  /** The job queue (APP_QUEUE). Enqueue through `enqueueJob`, never `send` directly. */
  readonly jobQueue: JobQueue;
  /** Feature-flag provider; features read it only through `evaluateFlag`. */
  readonly flags: FeatureFlags;
  /** The provider's own store (D1), or null when flags are managed elsewhere or off. */
  readonly flagStore: FeatureFlagStore | null;
  /** The deployed version id from CF_VERSION_METADATA, "local" without the binding. */
  readonly release: string;
  /** APP_ENV: required, no default (local, develop, staging, production). */
  readonly environment: string;
}

/** Per-isolate cache, like the database client. A config error is not cached. */
let cache: { readonly env: AppEnv; readonly platform: Platform } | undefined;

/**
 * The platform of this isolate. Throws a ConfigError naming the setting when LOG_SINK,
 * ERROR_REPORTER or FEATURE_FLAGS is missing or invalid, or the APP_QUEUE binding is
 * missing; the HTTP edge turns that into a 500. The D1 flag provider caches flags per
 * isolate for 30 s (D1_FLAGS_TTL_MS).
 */
export function buildPlatform(env: AppEnv): Platform {
  if (cache?.env === env) return cache.platform;
  const config = parsePlatformConfig(buildRawEnv(env));
  if (!env.APP_QUEUE) {
    throw new ConfigError(
      "APP_QUEUE",
      "APP_QUEUE is not bound: declare the queue producer in every environment of apps/web/wrangler.jsonc"
    );
  }
  const release = env.CF_VERSION_METADATA?.id || "local";
  const environment = config.APP_ENV;
  // OpenTelemetry resource attributes on every record.
  const resource: LogResource = {
    "service.name": SERVICE_NAME,
    "service.version": release,
    "deployment.environment.name": environment,
  };
  const logger =
    config.LOG_SINK === "workers-logs"
      ? createWorkersLogsLogger({ resource })
      : noopLogger;
  const d1Flags =
    config.FEATURE_FLAGS === "d1"
      ? createD1FeatureFlags({
          d1: env.DB,
          clock: systemClock,
          // Flags fall back to their catalog defaults; say so instead of failing silently.
          onLoadError: (error) =>
            logger.error("feature_flags.load_failed", { error }),
        })
      : null;
  const platform: Platform = {
    logger,
    errors:
      config.ERROR_REPORTER === "workers-logs"
        ? createWorkersLogsErrorReporter({ resource })
        : noopErrorReporter,
    jobQueue: createCloudflareJobQueue(env.APP_QUEUE),
    flags: d1Flags ?? noopFeatureFlags,
    flagStore: d1Flags,
    release,
    environment,
  };
  cache = { env, platform };
  return platform;
}

/** The logger for one unit of work: every record carries its trace and span ids and user. */
export function loggerFor(
  platform: Pick<Platform, "logger">,
  context: RequestContext
): Logger {
  return platform.logger.withContext(context);
}
