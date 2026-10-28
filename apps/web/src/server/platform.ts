/**
 * Composition root of the platform ports: picks one adapter per port from explicit settings
 * (LOG_SINK, ERROR_REPORTER) and builds it once per isolate. Adding a vendor means a new
 * adapter in packages/features/src/platform/adapters/<vendor>/, a new allowed value in
 * src/lib/config.ts and a branch here (docs/architecture/overview.md#ports-and-adapters).
 */
import {
  createWorkersLogsErrorReporter,
  createWorkersLogsLogger,
  type ErrorReporter,
  type Logger,
  noopErrorReporter,
  noopLogger,
  type RequestContext,
  requestContextFields,
} from "@cloudflare-starter/features";

import { parsePlatformConfig } from "@/lib/config";
import { buildRawEnv } from "@/lib/env";
import type { AppEnv } from "@/server/env";

export interface Platform {
  readonly logger: Logger;
  readonly errors: ErrorReporter;
  /** The deployed version id from CF_VERSION_METADATA, "local" without the binding. */
  readonly release: string;
  /** APP_ENV, "local" when unset. */
  readonly environment: string;
}

/** Per-isolate cache, like the database client. A config error is not cached. */
let cache: { readonly env: AppEnv; readonly platform: Platform } | undefined;

/**
 * The platform of this isolate. Throws a ConfigError naming the setting when LOG_SINK or
 * ERROR_REPORTER is missing or invalid; the HTTP edge turns that into a 500.
 */
export function buildPlatform(env: AppEnv): Platform {
  if (cache?.env === env) return cache.platform;
  const config = parsePlatformConfig(buildRawEnv(env));
  const platform: Platform = {
    logger:
      config.LOG_SINK === "workers-logs"
        ? createWorkersLogsLogger()
        : noopLogger,
    errors:
      config.ERROR_REPORTER === "workers-logs"
        ? createWorkersLogsErrorReporter()
        : noopErrorReporter,
    release: env.CF_VERSION_METADATA?.id || "local",
    environment: env.APP_ENV || "local",
  };
  cache = { env, platform };
  return platform;
}

/** The logger for one unit of work: every line carries its request id, user and release. */
export function loggerFor(
  platform: Pick<Platform, "logger">,
  context: RequestContext
): Logger {
  return platform.logger.child(requestContextFields(context));
}
