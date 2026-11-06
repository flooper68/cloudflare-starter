/**
 * The health endpoints for uptime monitors and status pages
 * (docs/guides/how-to-monitor-health.md): `/health/live` answers while the Worker runs,
 * `/health/ready` (and `/health`, its alias) checks each dependency with a deadline and
 * answers in the IETF health check response format (`application/health+json`): 200 for
 * pass and warn, 503 for fail. Public and unauthenticated, so: limited per IP
 * (`health.ip`), `Cache-Control: no-store`, no writes, and only statuses, latencies and
 * fixed reasons in the body. What went wrong goes to the logs under the request's trace
 * id, which the body carries as `reference`; platform admins see the detail through
 * `admin.health.get`. One span per check; no metric of its own (the HTTP edge measures
 * the request).
 */
import {
  bindingsOutcome,
  emailOutcome,
  HEALTH_CONTENT_TYPE,
  type HealthCheckResult,
  type HealthProbe,
  type HealthResponseBody,
  healthHttpStatus,
  healthResponseBody,
  type Logger,
  noopLogger,
  noopTracer,
  probeBucket,
  probeDatabase,
  type RequestContext,
  runHealthCheck,
  systemClock,
  type Tracer,
} from "@cloudflare-starter/features";

import { buildEmailFeature, buildRawEnv, buildRequiredConfig } from "@/lib/env";
import { getDb } from "@/server/db";
import type { AppEnv } from "@/server/env";
import { withHeaders } from "@/server/http";
import {
  buildPlatform,
  isJobQueueBound,
  loggerFor,
  type Platform,
  rateLimitBindingNames,
  SERVICE_NAME,
  tracerFor,
} from "@/server/platform";
import { rateLimitPolicyHeader } from "@/server/rate-limit-headers";
import {
  rateLimitedResponse,
  refuseOverLimit,
} from "@/server/rate-limited-response";

/** Path prefix of the health endpoints; the middleware skips the cookie session for it. */
export const HEALTH_PATH = "/health";

/** Each check's deadline; checks run in parallel, so readiness answers within it. */
export const HEALTH_CHECK_TIMEOUT_MS = 2000;
/** A service check slower than this is `warn`: up, but slow. */
export const HEALTH_WARN_ABOVE_MS = 1000;
/** Public version of the health response (`version`); bump on a breaking change. */
export const HEALTH_API_VERSION = "1";

export type HealthEndpoint = "live" | "ready";

/** Whether a path is one of the health endpoints (`/health`, `/health/live`, `/health/ready`). */
export function isHealthPath(pathname: string): boolean {
  return pathname === HEALTH_PATH || pathname.startsWith(`${HEALTH_PATH}/`);
}

/** The platform, or null when a setting is missing or invalid (the settings check says which). */
function platformOrNull(env: AppEnv): Platform | null {
  try {
    return buildPlatform(env);
  } catch {
    return null;
  }
}

/** Throws what the app would throw on every request when its settings are invalid. */
function parseSettings(env: AppEnv): undefined {
  buildPlatform(env);
  buildRequiredConfig(env);
  return undefined;
}

function verificationRequired(env: AppEnv): boolean {
  try {
    return buildRequiredConfig(env).AUTH_REQUIRE_EMAIL_VERIFICATION;
  } catch {
    // The settings check reports the invalid config itself.
    return false;
  }
}

/**
 * The readiness checks, in the order they are reported. D1 and R2 are called (one
 * `SELECT 1`, one `head` of a key that never exists); the rest look at bindings and
 * settings without calling anything (no mail is sent, no job enqueued).
 */
export function readinessProbes(env: AppEnv): HealthProbe[] {
  const raw = buildRawEnv(env);
  const record = env as Record<string, unknown>;
  const rateLimits =
    raw.RATE_LIMITING === "cloudflare" ? rateLimitBindingNames() : [];
  return [
    {
      name: "d1:responseTime",
      componentType: "datastore",
      measured: true,
      warnAboveMs: HEALTH_WARN_ABOVE_MS,
      run: () => probeDatabase({ db: getDb(env) }),
    },
    {
      name: "r2:responseTime",
      componentType: "datastore",
      measured: true,
      warnAboveMs: HEALTH_WARN_ABOVE_MS,
      run: () => probeBucket({ bucket: env.FILES }),
    },
    {
      name: "queue:binding",
      componentType: "component",
      run: () =>
        bindingsOutcome({
          APP_QUEUE: isJobQueueBound(env) ? true : undefined,
        }),
    },
    {
      name: "email:configuration",
      componentType: "component",
      run: () =>
        emailOutcome({
          configured: buildEmailFeature(env).enabled,
          verificationRequired: verificationRequired(env),
        }),
    },
    {
      name: "settings:configuration",
      componentType: "system",
      run: () => parseSettings(env),
    },
    {
      name: "rate-limits:bindings",
      componentType: "component",
      run: () =>
        bindingsOutcome(
          Object.fromEntries(rateLimits.map((name) => [name, record[name]]))
        ),
    },
    {
      name: "analytics-engine:bindings",
      componentType: "component",
      run: () =>
        bindingsOutcome({
          ...(raw.METRICS === "analytics-engine"
            ? { METRICS_DATASET: env.METRICS_DATASET }
            : {}),
          ...(raw.ANALYTICS === "analytics-engine"
            ? { ANALYTICS_EVENTS: env.ANALYTICS_EVENTS }
            : {}),
        }),
    },
  ];
}

/**
 * Runs the probes in parallel, each in its own span (`health.check <name>`, error status
 * on fail), and logs every check that did not pass with its detail.
 */
export async function runReadinessChecks(
  probes: readonly HealthProbe[],
  deps: {
    readonly tracer: Tracer;
    readonly logger: Logger;
    readonly timeoutMs?: number;
  }
): Promise<HealthCheckResult[]> {
  const timeoutMs = deps.timeoutMs ?? HEALTH_CHECK_TIMEOUT_MS;
  const results = await Promise.all(
    probes.map((probe) =>
      deps.tracer.startActiveSpan(
        `health.check ${probe.name}`,
        {
          "app.health.check": probe.name,
          "app.health.component_type": probe.componentType,
        },
        async (span) => {
          const result = await runHealthCheck(
            { clock: systemClock, timeoutMs },
            probe
          );
          span.setAttribute("app.health.status", result.status);
          span.setAttribute("app.health.observed_ms", result.observedValue);
          if (result.status === "fail") {
            span.setStatus({ code: "error", message: result.output });
          }
          return result;
        }
      )
    )
  );
  for (const result of results) {
    if (result.status === "pass") continue;
    const attributes = {
      "app.health.check": result.name,
      "app.health.status": result.status,
      "app.health.output": result.output,
      "app.health.detail": result.detail,
      "app.health.observed_ms": result.observedValue,
    };
    if (result.status === "fail")
      deps.logger.error("health.check_failed", attributes);
    else deps.logger.warn("health.check_degraded", attributes);
  }
  return results;
}

/**
 * The readiness report of this deployment. `detail: true` (platform admins) adds what
 * went wrong to each failed check's output; the public body never carries it.
 */
export async function readinessReport(
  env: AppEnv,
  context: RequestContext,
  options: {
    readonly detail?: boolean;
    readonly probes?: readonly HealthProbe[];
    readonly timeoutMs?: number;
  } = {}
): Promise<HealthResponseBody> {
  const platform = platformOrNull(env);
  const results = await runReadinessChecks(
    options.probes ?? readinessProbes(env),
    {
      tracer: platform ? tracerFor(platform, context) : noopTracer,
      logger: platform ? loggerFor(platform, context) : noopLogger,
      timeoutMs: options.timeoutMs,
    }
  );
  return healthResponseBody(
    {
      version: HEALTH_API_VERSION,
      releaseId: platform?.release ?? env.CF_VERSION_METADATA?.id ?? "local",
      serviceId: SERVICE_NAME,
      description: `Readiness of ${SERVICE_NAME}`,
      reference: context.traceId,
      results,
    },
    { detail: options.detail ?? false }
  );
}

/** The response headers of every health answer, 429s included. */
const HEALTH_HEADERS = {
  "cache-control": "no-store",
  "RateLimit-Policy": rateLimitPolicyHeader(["health.ip"]),
};

/**
 * Answers a health endpoint: counts the request against `health.ip` (when the platform
 * can be built), then liveness (`{"status":"pass"}`, no dependency touched) or the
 * readiness report. HEAD gets the same status and headers without a body.
 */
export async function healthResponse(
  endpoint: HealthEndpoint,
  request: Request,
  env: AppEnv,
  context: RequestContext,
  /** Tests replace the probes or the deadline; the routes never pass options. */
  options: {
    readonly probes?: readonly HealthProbe[];
    readonly timeoutMs?: number;
  } = {}
): Promise<Response> {
  const platform = platformOrNull(env);
  if (platform) {
    const refused = await refuseOverLimit(
      platform,
      "health.ip",
      { userId: null, ip: context.ip },
      (error) =>
        withHeaders(
          rateLimitedResponse(error, context, new URL(request.url).pathname),
          { "cache-control": "no-store" }
        )
    );
    if (refused) return refused;
  }

  const body =
    endpoint === "live"
      ? { status: "pass" as const }
      : await readinessReport(env, context, options);
  return new Response(request.method === "HEAD" ? null : JSON.stringify(body), {
    status: healthHttpStatus(body.status),
    headers: { "content-type": HEALTH_CONTENT_TYPE, ...HEALTH_HEADERS },
  });
}
