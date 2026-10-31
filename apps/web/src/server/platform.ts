/**
 * Composition root of the platform ports: picks one adapter per port from explicit settings
 * (LOG_SINK, ERROR_REPORTER, FEATURE_FLAGS, METRICS, TRACING, RATE_LIMITING, TURNSTILE, ANALYTICS) and builds it once per isolate. JobQueue has one
 * adapter, the APP_QUEUE binding, and no setting: it has no "off" (dropping jobs silently is
 * unsafe). Adding a vendor means a new
 * adapter in packages/features/src/platform/adapters/<vendor>/, a new allowed value in
 * src/lib/config.ts and a branch here (docs/architecture/overview.md#ports-and-adapters).
 */
import {
  createAnalyticsEngineMetrics,
  createAnalyticsEngineProductAnalytics,
  createCloudflareJobQueue,
  createCloudflareRateLimiter,
  createD1FeatureFlags,
  createTurnstileVerifier,
  createWorkersLogsErrorReporter,
  createWorkersLogsLogger,
  createWorkersTracer,
  type EmailService,
  type ErrorReporter,
  type FeatureFlagStore,
  type FeatureFlags,
  type HumanVerifier,
  type JobQueue,
  type Logger,
  type LogResource,
  type Metrics,
  noopEmail,
  noopErrorReporter,
  noopFeatureFlags,
  noopHumanVerifier,
  noopLogger,
  noopMetrics,
  noopProductAnalytics,
  noopRateLimiter,
  noopTracer,
  type ProductAnalytics,
  RATE_LIMIT_POLICIES,
  type RateLimiter,
  type RateLimitPolicy,
  type RequestContext,
  randomIds,
  type StorageReconcileMode,
  systemClock,
  type Tracer,
} from "@cloudflare-starter/features";

import {
  type AbuseConfig,
  type AnalyticsConfig,
  ConfigError,
  parseAbuseConfig,
  parseAnalyticsConfig,
  parsePlatformConfig,
} from "@/lib/config";
import { buildEmailFeature, buildRawEnv } from "@/lib/env";
import type { AppEnv } from "@/server/env";

/**
 * OpenTelemetry `service.name` of this Worker. Keep it equal to `name` in wrangler.jsonc
 * (rename both when a project renames the Worker).
 */
export const SERVICE_NAME = "cloudflare-starter-web";

export interface Platform {
  readonly storageReconcile: StorageReconcileMode;
  readonly logger: Logger;
  readonly errors: ErrorReporter;
  /** The job queue (APP_QUEUE). Enqueue through `enqueueJob`, never `send` directly. */
  readonly jobQueue: JobQueue;
  /** Feature-flag provider; features read it only through `evaluateFlag`. */
  readonly flags: FeatureFlags;
  /** The provider's own store (D1), or null when flags are managed elsewhere or off. */
  readonly flagStore: FeatureFlagStore | null;
  /** Flushed once at the end of each unit of work (HTTP request, queue batch, cron run). */
  readonly metrics: Metrics;
  readonly tracer: Tracer;
  /**
   * Outgoing mail (the EMAIL binding with EMAIL_FROM), or the noop adapter when either is
   * missing: `email.enabled` says which.
   */
  readonly email: EmailService;
  /** The deployed version id from CF_VERSION_METADATA, "local" without the binding. */
  readonly release: string;
  /** APP_ENV: required, no default (local, develop, staging, production). */
  readonly environment: string;
  /** Edge rate limits (RATE_LIMITING): adapters call `enforceRateLimit` with it. */
  readonly rateLimiter: RateLimiter;
  /** The human check on sign-up, sign-in and password reset (TURNSTILE). */
  readonly humanVerifier: HumanVerifier;
  /** What the auth pages need to render the widget; null with TURNSTILE=off. */
  readonly turnstile: { readonly siteKey: string } | null;
  /**
   * A ProductAnalytics for one unit of work (ANALYTICS): call it once per request, job or
   * hook. Each instance counts its own data points (Analytics Engine takes 250 per
   * invocation). Features track through `trackEvent`, never the port directly.
   */
  readonly productAnalytics: () => ProductAnalytics;
  /** The Web Analytics beacon's site token; null with WEB_ANALYTICS=none. */
  readonly webAnalytics: { readonly token: string } | null;
}

/** The Workers Rate Limiting bindings the catalog's edge policies use. */
export function rateLimitBindingNames(): string[] {
  const policies: readonly RateLimitPolicy[] =
    Object.values(RATE_LIMIT_POLICIES);
  return [
    ...new Set(policies.flatMap((policy) => policy.binding ?? [])),
  ].sort();
}

/** RATE_LIMITING=cloudflare needs every binding the catalog names. */
function buildRateLimiter(env: AppEnv, config: AbuseConfig): RateLimiter {
  if (config.RATE_LIMITING === "none") return noopRateLimiter;
  const bindings: Record<string, RateLimit> = {};
  for (const name of rateLimitBindingNames()) {
    const binding = (env as Record<string, unknown>)[name] as
      | RateLimit
      | undefined;
    if (!binding) {
      throw new ConfigError(
        name,
        `RATE_LIMITING=cloudflare needs the ${name} ratelimits binding in every environment of apps/web/wrangler.jsonc`
      );
    }
    bindings[name] = binding;
  }
  return createCloudflareRateLimiter(bindings);
}

/** METRICS=analytics-engine needs the METRICS_DATASET binding. */
function buildMetrics(
  env: AppEnv,
  choice: "analytics-engine" | "none",
  resource: LogResource
): Metrics {
  if (choice === "none") return noopMetrics;
  if (!env.METRICS_DATASET) {
    throw new ConfigError(
      "METRICS",
      "METRICS is analytics-engine but the METRICS_DATASET binding is missing: add analytics_engine_datasets to this environment of apps/web/wrangler.jsonc, or set METRICS to none"
    );
  }
  return createAnalyticsEngineMetrics({
    dataset: env.METRICS_DATASET,
    resource,
  });
}

/** The Email adapter: Cloudflare Email Service when the binding and EMAIL_FROM are set. */
function emailOf(env: AppEnv): EmailService {
  const email = buildEmailFeature(env);
  return email.enabled && email.value ? email.value : noopEmail;
}

/** ANALYTICS=analytics-engine needs the ANALYTICS_EVENTS dataset binding. */
function buildProductAnalytics(
  env: AppEnv,
  config: AnalyticsConfig,
  logger: Logger
): () => ProductAnalytics {
  if (config.ANALYTICS === "none") return () => noopProductAnalytics;
  const dataset = env.ANALYTICS_EVENTS;
  // parseAnalyticsConfig refused a missing or short secret already.
  const idSecret = config.ANALYTICS_ID_SECRET ?? "";
  if (!dataset) {
    throw new ConfigError(
      "ANALYTICS_EVENTS",
      "ANALYTICS=analytics-engine needs the ANALYTICS_EVENTS analytics_engine_datasets binding in every environment of apps/web/wrangler.jsonc"
    );
  }
  return () =>
    createAnalyticsEngineProductAnalytics({
      dataset,
      idSecret,
      onDrop: (event, reason) =>
        logger.warn("product_analytics.dropped", {
          "app.analytics.event": event,
          "app.analytics.reason": reason,
        }),
    });
}

/** Per-isolate cache, like the database client. A config error is not cached. */
let cache: { readonly env: AppEnv; readonly platform: Platform } | undefined;

/**
 * The platform of this isolate. Throws a ConfigError naming the setting when LOG_SINK,
 * ERROR_REPORTER, FEATURE_FLAGS, METRICS or TRACING is missing or invalid, or the APP_QUEUE
 * or METRICS_DATASET binding is missing; the HTTP edge turns that into a 500. The D1 flag provider caches flags per
 * isolate for 30 s (D1_FLAGS_TTL_MS).
 */
export function buildPlatform(env: AppEnv): Platform {
  if (cache?.env === env) return cache.platform;
  const raw = buildRawEnv(env);
  const config = parsePlatformConfig(raw);
  const abuse = parseAbuseConfig(raw);
  const analytics = parseAnalyticsConfig(raw);
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
    storageReconcile: config.STORAGE_RECONCILE,
    logger,
    errors:
      config.ERROR_REPORTER === "workers-logs"
        ? createWorkersLogsErrorReporter({ resource })
        : noopErrorReporter,
    jobQueue: createCloudflareJobQueue(env.APP_QUEUE),
    email: emailOf(env),
    flags: d1Flags ?? noopFeatureFlags,
    flagStore: d1Flags,
    metrics: buildMetrics(env, config.METRICS, resource),
    tracer:
      config.TRACING === "workers"
        ? createWorkersTracer({ resource })
        : noopTracer,
    release,
    environment,
    rateLimiter: buildRateLimiter(env, abuse),
    humanVerifier:
      abuse.TURNSTILE === "on" && abuse.TURNSTILE_SECRET_KEY
        ? createTurnstileVerifier({
            secretKey: abuse.TURNSTILE_SECRET_KEY,
            // workerd's fetch must not be called as a method of another object.
            fetch: (input, init) => fetch(input, init),
            ids: randomIds,
          })
        : noopHumanVerifier,
    turnstile:
      abuse.TURNSTILE === "on" && abuse.TURNSTILE_SITE_KEY
        ? { siteKey: abuse.TURNSTILE_SITE_KEY }
        : null,
    productAnalytics: buildProductAnalytics(env, analytics, logger),
    webAnalytics:
      analytics.WEB_ANALYTICS === "cloudflare" && analytics.WEB_ANALYTICS_TOKEN
        ? { token: analytics.WEB_ANALYTICS_TOKEN }
        : null,
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

/** The tracer for one unit of work: its spans are children of the context's span. */
export function tracerFor(
  platform: Pick<Platform, "tracer">,
  context: RequestContext
): Tracer {
  return platform.tracer.withContext(context);
}
