/**
 * The HTTP edge: every on-demand request gets a request context (server-generated id), every
 * response an `x-request-id` header, and an unhandled error becomes a 500 with a reference
 * the user can quote. Used by src/middleware.ts; API tests call it directly.
 */
import {
  createRequestContext,
  type LogFields,
  type RequestContext,
  randomIds,
} from "@cloudflare-starter/features";

import { ConfigError } from "@/lib/config";
import type { AppEnv } from "@/server/env";
import { buildPlatform } from "@/server/platform";

export const REQUEST_ID_HEADER = "x-request-id";

/** The request's context, which the middleware completes once it knows the user. */
export interface RequestScope {
  readonly context: RequestContext;
  setUserId(userId: string | null): RequestContext;
}

/** Sets the header, copying the response first when its headers are immutable. */
export function withRequestId(response: Response, requestId: string): Response {
  try {
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  } catch {
    const copy = new Response(response.body, response);
    copy.headers.set(REQUEST_ID_HEADER, requestId);
    return copy;
  }
}

/** Reports an unexpected error and answers 500 with its reference (never the error itself). */
export function internalErrorResponse(
  env: AppEnv,
  error: unknown,
  context: RequestContext,
  extra?: LogFields
): Response {
  const reference = buildPlatform(env).errors.capture(error, context, extra);
  return Response.json({ error: "Internal error", reference }, { status: 500 });
}

function requestFields(request: Request): LogFields {
  return {
    method: request.method,
    path: new URL(request.url).pathname,
    // Cloudflare's own id for the request; links our requestId to Cloudflare's logs.
    cfRay: request.headers.get("cf-ray"),
  };
}

export async function withRequestContext(
  request: Request,
  env: AppEnv,
  handle: (scope: RequestScope) => Promise<Response>
): Promise<Response> {
  let platform: ReturnType<typeof buildPlatform>;
  try {
    platform = buildPlatform(env);
  } catch (error) {
    // No logger without config: the response names the setting to fix.
    const requestId = randomIds.uuid();
    const message =
      error instanceof ConfigError
        ? error.message
        : "Server configuration is invalid";
    return withRequestId(
      Response.json({ error: message, reference: requestId }, { status: 500 }),
      requestId
    );
  }

  // Never trust an incoming x-request-id: the id is generated here.
  let context = createRequestContext(
    { ids: randomIds },
    {
      source: "http",
      release: platform.release,
      environment: platform.environment,
      ip: request.headers.get("cf-connecting-ip"),
    }
  );
  const scope: RequestScope = {
    get context() {
      return context;
    },
    setUserId(userId) {
      context = { ...context, userId };
      return context;
    },
  };

  let response: Response;
  try {
    response = await handle(scope);
  } catch (error) {
    response = internalErrorResponse(env, error, context, {
      ...requestFields(request),
      edge: "http",
    });
  }
  return withRequestId(response, context.requestId);
}
