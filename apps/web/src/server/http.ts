/**
 * The HTTP edge: every on-demand request gets a request context (a W3C trace: continued
 * from a valid incoming `traceparent`, with our own span), every response `traceparent`
 * and `x-request-id` (the trace id) headers, and an unhandled error becomes an RFC 9457
 * Problem Details 500 with a reference the user can quote. Each request is also an
 * OpenTelemetry server span (the context's own span id) and one measurement of
 * `http.server.request.duration`; the request's metrics are flushed when it ends. Used by
 * server/app-middleware.ts; API tests call it directly.
 */
import {
  createRequestContext,
  formatTraceparent,
  type LogFields,
  type RequestContext,
  randomIds,
  type Span,
  systemClock,
} from "@cloudflare-starter/features";

import { ConfigError } from "@/lib/config";
import { redactUrlPath } from "@/lib/redact-url";
import type { AppEnv } from "@/server/env";
import { httpMethodAttribute, secondsSince } from "@/server/instrumentation";
import { buildPlatform, tracerFor } from "@/server/platform";
import { runInRequestScope } from "@/server/request-scope";

/** The trace id, for people: quote it to find the request's logs. */
export const REQUEST_ID_HEADER = "x-request-id";
/** W3C Trace Context header. */
export const TRACEPARENT_HEADER = "traceparent";

/** The request's context, which the middleware completes once it knows the user. */
export interface RequestScope {
  readonly context: RequestContext;
  setUserId(userId: string | null): RequestContext;
}

/** Sets headers, copying the response first when its headers are immutable. */
export function withHeaders(
  response: Response,
  headers: Readonly<Record<string, string>>
): Response {
  const apply = (target: Response) => {
    for (const [name, value] of Object.entries(headers)) {
      target.headers.set(name, value);
    }
    return target;
  };
  try {
    return apply(response);
  } catch {
    // Immutable headers (redirects, fetched responses): copy first.
    return apply(new Response(response.body, response));
  }
}

/** Adds the trace headers of this request to its response. */
export function withTraceHeaders(
  response: Response,
  context: Pick<RequestContext, "traceId" | "spanId" | "traceFlags">
): Response {
  return withHeaders(response, {
    [TRACEPARENT_HEADER]: formatTraceparent(context),
    [REQUEST_ID_HEADER]: context.traceId,
  });
}

/**
 * An RFC 9457 Problem Details response (`application/problem+json`). `reference` is an
 * extension member: the trace id users quote.
 */
export function problemResponse(
  status: number,
  title: string,
  detail: string,
  extensions: Readonly<Record<string, unknown>> = {}
): Response {
  return new Response(
    JSON.stringify({
      type: "about:blank",
      title,
      status,
      detail,
      ...extensions,
    }),
    {
      status,
      headers: { "content-type": "application/problem+json" },
    }
  );
}

/** Reports an unexpected error and answers 500 with its reference (never the error itself). */
export function internalErrorResponse(
  env: AppEnv,
  error: unknown,
  context: RequestContext,
  extra?: LogFields
): Response {
  const reference = buildPlatform(env).errors.capture(error, context, {
    "http.response.status_code": 500,
    ...extra,
  });
  return problemResponse(
    500,
    "Internal Server Error",
    "Something went wrong on our side. Quote the reference when you report it.",
    { reference }
  );
}

/** OpenTelemetry HTTP attributes of the request, plus Cloudflare's ray id. */
export function httpAttributes(request: Request): LogFields {
  return {
    "http.request.method": request.method,
    // Reset, verification and invitation paths carry tokens: never log them as they are.
    "url.path": redactUrlPath(new URL(request.url).pathname),
    // Cloudflare's own id for the request; links our trace id to Cloudflare's logs.
    "app.cloudflare.ray_id": request.headers.get("cf-ray") ?? undefined,
  };
}

export interface HttpEdgeOptions {
  /**
   * The matched route template (`/api/files/[id]`, Astro's `routePattern`): the
   * low-cardinality `http.route` of the span and metric. Omitted when unknown; never the
   * raw path.
   */
  readonly route?: string;
}

export async function withRequestContext(
  request: Request,
  env: AppEnv,
  handle: (scope: RequestScope) => Promise<Response>,
  options: HttpEdgeOptions = {}
): Promise<Response> {
  let platform: ReturnType<typeof buildPlatform>;
  try {
    platform = buildPlatform(env);
  } catch (error) {
    // No logger without config: the response names the setting to fix. The trace still
    // continues an incoming traceparent, so callers can correlate the failure.
    const context = createRequestContext(
      { ids: randomIds },
      {
        source: "http",
        release: "unknown",
        environment: "unknown",
        traceparent: request.headers.get(TRACEPARENT_HEADER),
      }
    );
    const message =
      error instanceof ConfigError
        ? error.message
        : "Server configuration is invalid";
    return withTraceHeaders(
      problemResponse(500, "Server Misconfigured", message, {
        reference: context.traceId,
      }),
      context
    );
  }

  // An incoming traceparent is continued for correlation only; x-request-id is ignored.
  let context = createRequestContext(
    { ids: randomIds },
    {
      source: "http",
      release: platform.release,
      environment: platform.environment,
      traceparent: request.headers.get(TRACEPARENT_HEADER),
      ip: request.headers.get("cf-connecting-ip"),
    }
  );
  let serverSpan: Span | undefined;
  const scope: RequestScope = {
    get context() {
      return context;
    },
    setUserId(userId) {
      context = { ...context, userId };
      serverSpan?.setAttribute("user.id", userId ?? undefined);
      return context;
    },
  };

  const started = systemClock.now();
  const method = httpMethodAttribute(request.method);
  const scheme = new URL(request.url).protocol.replace(/:$/, "");
  const attributes = {
    "http.request.method": method,
    "url.scheme": scheme,
    "http.route": options.route,
  };

  // The request's own span (OpenTelemetry server span): name `{method} {http.route}`.
  const response = await tracerFor(platform, context).startContextSpan(
    options.route ? `${method} ${options.route}` : method,
    {
      ...attributes,
      // Spans may carry the (redacted) path and the ray id; metrics never do.
      "url.path": redactUrlPath(new URL(request.url).pathname),
      "app.cloudflare.ray_id": request.headers.get("cf-ray") ?? undefined,
    },
    async (span) => {
      serverSpan = span;
      let result: Response;
      try {
        // In scope for code that cannot take the context as an argument (Better Auth hooks).
        result = await runInRequestScope(scope, () => handle(scope));
      } catch (error) {
        span.recordException(error);
        result = internalErrorResponse(env, error, context, {
          ...httpAttributes(request),
          "app.error.origin": "http",
        });
      }
      span.setAttribute("http.response.status_code", result.status);
      if (result.status >= 500) {
        span.setAttribute("error.type", String(result.status));
        span.setStatus({ code: "error" });
      }
      return result;
    }
  );

  platform.metrics
    .histogram("http.server.request.duration")
    .record(secondsSince(systemClock, started), {
      ...attributes,
      "http.response.status_code": response.status,
      "error.type":
        response.status >= 500 ? String(response.status) : undefined,
    });
  // One flush per request: everything measured while serving it (tRPC, MCP) goes out now.
  platform.metrics.flush();
  return withTraceHeaders(response, context);
}
