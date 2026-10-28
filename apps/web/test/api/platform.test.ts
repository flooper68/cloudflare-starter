// The platform edge: W3C trace headers on every response, OpenTelemetry error reports,
// references (the trace id) on internal errors (tRPC, MCP tools, file routes), and the
// named error when a platform setting is missing.
import { env } from "cloudflare:workers";
import { noopTracer } from "@cloudflare-starter/features";
import { createMcpHandler } from "@modelcontextprotocol/server";
import type { APIContext } from "astro";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { POST as uploadFile } from "@/pages/api/files/index";
import { POST as trpcPost } from "@/pages/api/trpc/[...trpc]";
import {
  handleAppRequest,
  type MiddlewareContext,
} from "@/server/app-middleware";
import type { AppEnv } from "@/server/env";
import {
  REQUEST_ID_HEADER,
  TRACEPARENT_HEADER,
  withRequestContext,
} from "@/server/http";
import { buildMcpServer } from "@/server/mcp/server";

import {
  APP_URL,
  callerFor,
  signUp,
  type TestUser,
  testRequestContext,
} from "./helpers";

const TRACE_ID = /^[0-9a-f]{32}$/;
const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/;
const INCOMING = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";

interface Report {
  readonly body: string;
  readonly trace_id: string;
  readonly span_id: string;
  readonly attributes: Record<string, unknown>;
  readonly resource: Record<string, string>;
}

/** Error reports written to Workers Logs (LOG_SINK/ERROR_REPORTER are workers-logs here). */
function captureReports() {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  return () =>
    spy.mock.calls
      .map(([record]) => record as Report)
      .filter((record) => record?.body === "error.captured");
}

function routeContext(
  request: Request,
  user: TestUser,
  requestContext: APIContext["locals"]["requestContext"]
) {
  return {
    request,
    url: new URL(request.url),
    params: {},
    locals: {
      user: { id: user.id, email: user.email, name: user.name },
      requestContext,
    },
  } as unknown as APIContext;
}

describe("platform edge (trace context and error references)", () => {
  let user: TestUser;
  beforeAll(async () => {
    user = await signUp("Nicole Example", "nicole@example.test");
  });
  afterEach(() => vi.restoreAllMocks());

  it("gives every response traceparent and x-request-id (the trace id), ignoring an incoming x-request-id", async () => {
    const ok = await withRequestContext(
      new Request(`${APP_URL}/api/hello`, {
        headers: { [REQUEST_ID_HEADER]: "client-chosen-id" },
      }),
      env,
      async () => new Response("ok")
    );
    const traceId = ok.headers.get(REQUEST_ID_HEADER);
    expect(traceId).toMatch(TRACE_ID);
    expect(ok.headers.get(TRACEPARENT_HEADER)).toMatch(TRACEPARENT);
    expect(ok.headers.get(TRACEPARENT_HEADER)).toContain(`-${traceId}-`);

    // Responses with immutable headers (redirects, fetched responses) are copied.
    const redirect = await withRequestContext(
      new Request(`${APP_URL}/app`),
      env,
      async () => Response.redirect(`${APP_URL}/sign-in`, 302)
    );
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get(REQUEST_ID_HEADER)).toMatch(TRACE_ID);
    expect(redirect.headers.get(TRACEPARENT_HEADER)).toMatch(TRACEPARENT);
  });

  it("continues a valid incoming traceparent with its own span, and ignores an invalid one", async () => {
    const continued = await withRequestContext(
      new Request(`${APP_URL}/api/hello`, {
        headers: { [TRACEPARENT_HEADER]: INCOMING },
      }),
      env,
      async (scope) => {
        expect(scope.context.parentSpanId).toBe("00f067aa0ba902b7");
        return new Response("ok");
      }
    );
    const [, traceId, spanId] =
      TRACEPARENT.exec(continued.headers.get(TRACEPARENT_HEADER) ?? "") ?? [];
    expect(traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    expect(spanId).not.toBe("00f067aa0ba902b7");
    expect(continued.headers.get(REQUEST_ID_HEADER)).toBe(traceId);

    const fresh = await withRequestContext(
      new Request(`${APP_URL}/api/hello`, {
        headers: { [TRACEPARENT_HEADER]: "00-zzz-01" },
      }),
      env,
      async () => new Response("ok")
    );
    expect(fresh.headers.get(REQUEST_ID_HEADER)).toMatch(TRACE_ID);
    expect(fresh.headers.get(REQUEST_ID_HEADER)).not.toBe(
      "4bf92f3577b34da6a3ce929d0e0e4736"
    );
  });

  describe("the app middleware (src/middleware.ts)", () => {
    function middlewareContext(path: string, cookie?: string) {
      const request = new Request(`${APP_URL}${path}`, {
        headers: cookie ? { cookie } : {},
      });
      return {
        request,
        url: new URL(request.url),
        isPrerendered: false,
        locals: {} as MiddlewareContext["locals"],
        redirect: (to: string) =>
          new Response(null, { status: 302, headers: { location: to } }),
      } satisfies MiddlewareContext;
    }

    it("gives /mcp a request context and trace headers before its early return", async () => {
      const context = middlewareContext("/mcp");
      const response = await handleAppRequest(
        context,
        env,
        async () => new Response(null, { status: 401 })
      );
      expect(response.headers.get(REQUEST_ID_HEADER)).toBe(
        context.locals.requestContext.traceId
      );
      expect(response.headers.get(TRACEPARENT_HEADER)).toContain(
        context.locals.requestContext.spanId
      );
      expect(context.locals.requestContext).toMatchObject({
        source: "http",
        userId: null,
      });
    });

    it("stamps the protected-page redirect and records the signed-in user", async () => {
      const anonymous = middlewareContext("/app/dashboard");
      const redirect = await handleAppRequest(
        anonymous,
        env,
        async () => new Response("never")
      );
      expect(redirect.status).toBe(302);
      expect(redirect.headers.get(REQUEST_ID_HEADER)).toMatch(TRACE_ID);

      const signedIn = middlewareContext("/app/dashboard", user.cookie);
      const page = await handleAppRequest(
        signedIn,
        env,
        async () => new Response("dashboard")
      );
      expect(page.status).toBe(200);
      expect(signedIn.locals.requestContext.userId).toBe(user.id);
      expect(page.headers.get(REQUEST_ID_HEADER)).toBe(
        signedIn.locals.requestContext.traceId
      );
    });
  });

  it("turns an unhandled error into a Problem Details 500 and an OpenTelemetry error report", async () => {
    const reports = captureReports();
    const response = await withRequestContext(
      new Request(`${APP_URL}/boom`, { headers: { "cf-ray": "8f00-AMS" } }),
      env,
      async () => {
        throw new Error("render failed");
      }
    );
    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toBe(
      "application/problem+json"
    );
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({
      type: "about:blank",
      title: "Internal Server Error",
      status: 500,
      detail:
        "Something went wrong on our side. Quote the reference when you report it.",
      reference: response.headers.get(REQUEST_ID_HEADER),
    });
    expect(reports()).toEqual([
      expect.objectContaining({
        trace_id: body.reference,
        severity_text: "ERROR",
        resource: {
          "service.name": "cloudflare-starter-web",
          "service.version": expect.any(String),
          "deployment.environment.name": "develop",
        },
        attributes: expect.objectContaining({
          "app.request.source": "http",
          "http.request.method": "GET",
          "url.path": "/boom",
          "http.response.status_code": 500,
          "app.cloudflare.ray_id": "8f00-AMS",
          "exception.type": "Error",
          "exception.message": "render failed",
          "exception.stacktrace": expect.stringContaining("render failed"),
        }),
      }),
    ]);
  });

  it("returns data.reference equal to x-request-id for an internal tRPC error", async () => {
    vi.spyOn(env.APP_QUEUE as Queue, "send").mockRejectedValue(
      new Error("queue unavailable")
    );
    const reports = captureReports();
    const request = new Request(`${APP_URL}/api/trpc/queue.enqueueHello`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-trpc-source": "app" },
      body: JSON.stringify({ name: "Barbara" }),
    });

    const response = await withRequestContext(request, env, async (scope) =>
      trpcPost(routeContext(request, user, scope.setUserId(user.id)))
    );

    expect(response.status).toBe(500);
    const body = (await response.json()) as {
      error: {
        message: string;
        data: { code: string; reference?: string; stack?: string };
      };
    };
    const header = response.headers.get(REQUEST_ID_HEADER);
    expect(header).toMatch(TRACE_ID);
    expect(body.error.data).toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      reference: header,
    });
    // The cause stays in the report; the client gets a generic message and no stack.
    expect(body.error.message).toBe("Internal error");
    expect(body.error.data.stack).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("queue unavailable");
    expect(reports()).toEqual([
      expect.objectContaining({
        trace_id: header,
        attributes: expect.objectContaining({
          "user.id": user.id,
          "rpc.system.name": "trpc",
          "rpc.method": "queue.enqueueHello",
          "exception.message": "queue unavailable",
        }),
      }),
    ]);
  });

  it("gives expected tRPC errors no reference and no stack", async () => {
    const request = new Request(`${APP_URL}/api/trpc/queue.enqueueHello`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-trpc-source": "app" },
      body: JSON.stringify({ name: "" }),
    });
    const response = await withRequestContext(request, env, async (scope) =>
      trpcPost(routeContext(request, user, scope.context))
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error: { data: Record<string, unknown> };
    };
    expect(body.error.data).not.toHaveProperty("reference");
    expect(body.error.data).not.toHaveProperty("stack");
  });

  it("returns the reference in an MCP tool error", async () => {
    vi.spyOn(env.APP_QUEUE as Queue, "send").mockRejectedValue(
      new Error("queue unavailable")
    );
    const reports = captureReports();
    const requestContext = testRequestContext();
    const caller = callerFor(user, env as AppEnv, requestContext);
    const context = {
      errors: { capture: vi.fn() },
      requestContext,
      tracer: noopTracer,
    };
    const handler = createMcpHandler(() =>
      buildMcpServer(() => caller, context)
    );
    const response = await handler.fetch(
      new Request(`${APP_URL}/mcp`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "enqueue_hello", arguments: { name: "from MCP" } },
        }),
      })
    );
    const text = await response.text();
    const json = text.startsWith("{")
      ? text
      : (
          text.split("\n").find((line) => line.startsWith("data: ")) ?? ""
        ).slice(6);
    const result = JSON.parse(json).result;

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      httpStatus: 500,
      message: "Internal error",
      reference: requestContext.traceId,
    });
    // Reported once, by the procedure, not again by the tool wrapper.
    expect(context.errors.capture).not.toHaveBeenCalled();
    expect(reports()).toEqual([
      expect.objectContaining({ trace_id: requestContext.traceId }),
    ]);
  });

  it("answers a failed file upload with a Problem Details 500 and the reference", async () => {
    vi.spyOn(env.FILES, "put").mockRejectedValue(new Error("R2 down"));
    const reports = captureReports();
    const form = new FormData();
    form.set(
      "file",
      new File(["Q4 roadmap"], "notes.txt", { type: "text/plain" })
    );
    const request = new Request(`${APP_URL}/api/files`, {
      method: "POST",
      body: form,
      headers: { origin: APP_URL, "cf-ray": "8f01-AMS" },
    });
    const requestContext = testRequestContext();

    const response = await uploadFile(
      routeContext(request, user, requestContext)
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      status: 500,
      title: "Internal Server Error",
      reference: requestContext.traceId,
    });
    expect(reports()).toEqual([
      expect.objectContaining({
        trace_id: requestContext.traceId,
        attributes: expect.objectContaining({
          "http.route": "/api/files",
          "http.request.method": "POST",
          "app.cloudflare.ray_id": "8f01-AMS",
          "exception.message": "R2 down",
        }),
      }),
    ]);
  });

  it("fails with a Problem Details error naming LOG_SINK when the setting is missing", async () => {
    const handle = vi.fn(async () => new Response("never"));
    const misconfigured = { ...env, LOG_SINK: undefined } as AppEnv;
    const response = await withRequestContext(
      new Request(`${APP_URL}/api/hello`, {
        headers: { [TRACEPARENT_HEADER]: INCOMING },
      }),
      misconfigured,
      handle
    );
    expect(handle).not.toHaveBeenCalled();
    expect(response.status).toBe(500);
    const body = (await response.json()) as Record<string, string>;
    expect(body.detail).toMatch(
      /^LOG_SINK is not set: set LOG_SINK to one of workers-logs, none/
    );
    // Even without a platform the trace continues and both headers are set.
    expect(body.reference).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe(body.reference);
    const [, traceId, spanId] =
      TRACEPARENT.exec(response.headers.get(TRACEPARENT_HEADER) ?? "") ?? [];
    expect(traceId).toBe(body.reference);
    expect(spanId).not.toBe("00f067aa0ba902b7");
  });

  it("fails with an error naming APP_ENV when the environment is not set (no default)", async () => {
    const misconfigured = { ...env, APP_ENV: undefined } as AppEnv;
    const response = await withRequestContext(
      new Request(`${APP_URL}/api/hello`),
      misconfigured,
      async () => new Response("never")
    );
    expect(response.status).toBe(500);
    const body = (await response.json()) as Record<string, string>;
    expect(body.detail).toMatch(/^APP_ENV is not set/);
    expect(response.headers.get(TRACEPARENT_HEADER)).toMatch(TRACEPARENT);
  });

  it("fails with an error naming METRICS_DATASET when METRICS=analytics-engine has no binding", async () => {
    const misconfigured = {
      ...env,
      METRICS: "analytics-engine",
      METRICS_DATASET: undefined,
    } as AppEnv;
    const response = await withRequestContext(
      new Request(`${APP_URL}/api/hello`),
      misconfigured,
      async () => new Response("never")
    );
    expect(response.status).toBe(500);
    const body = (await response.json()) as Record<string, string>;
    expect(body.detail).toMatch(
      /^METRICS is analytics-engine but the METRICS_DATASET binding is missing/
    );
  });

  it("fails with an error naming METRICS when the setting is missing", async () => {
    const response = await withRequestContext(
      new Request(`${APP_URL}/api/hello`),
      { ...env, METRICS: undefined } as AppEnv,
      async () => new Response("never")
    );
    const body = (await response.json()) as Record<string, string>;
    expect(body.detail).toMatch(
      /^METRICS is not set: set METRICS to one of analytics-engine, none/
    );
  });

  it("never logs the token in a reset, verification or invitation path", async () => {
    const reports = captureReports();
    for (const path of [
      "/api/auth/reset-password/tok_secret123?callbackURL=%2Freset-password",
      "/invite/inv_secret456",
    ]) {
      await withRequestContext(
        new Request(`${APP_URL}${path}`),
        env,
        async () => {
          throw new Error("render failed");
        }
      );
    }
    const paths = reports().map((report) => report.attributes["url.path"]);
    expect(paths).toEqual([
      "/api/auth/reset-password/[redacted]",
      "/invite/[redacted]",
    ]);
    expect(JSON.stringify(reports())).not.toMatch(/tok_secret|inv_secret/);
  });
});
