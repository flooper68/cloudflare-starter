// Metrics and spans of real requests: the HTTP edge with the app's configured adapters
// (TRACING=workers writes span records to the console, METRICS=analytics-engine writes data
// points to the simulated METRICS_DATASET binding), and tRPC procedures and MCP tools with
// the memory adapters.
import { env } from "cloudflare:workers";
import {
  createMemoryMetrics,
  createMemoryTracer,
  fromDataPoint,
  SPAN_EVENT,
  type SpanRecord,
} from "@cloudflare-starter/features";
import { createMcpHandler } from "@modelcontextprotocol/server";
import type { APIContext } from "astro";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { POST as trpcPost } from "@/pages/api/trpc/[...trpc]";
import { REQUEST_ID_HEADER, withRequestContext } from "@/server/http";
import { buildMcpServer, callerInSpan } from "@/server/mcp/server";
import { createAppContext } from "@/server/trpc/context";
import { appRouter } from "@/server/trpc/router";

import { APP_URL, signUp, type TestUser, testRequestContext } from "./helpers";

/** Span records the Workers tracer wrote (console.info, or console.error for errors). */
function captureSpans() {
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  return () =>
    [...info.mock.calls, ...error.mock.calls]
      .map(([record]) => record as SpanRecord)
      .filter((record) => record?.body === SPAN_EVENT);
}

/** Data points written to the Analytics Engine dataset, decoded with the documented layout. */
function captureDataPoints() {
  const spy = vi.spyOn(
    env.METRICS_DATASET as AnalyticsEngineDataset,
    "writeDataPoint"
  );
  return () => spy.mock.calls.map(([point]) => fromDataPoint(point ?? {}));
}

/** A tRPC caller whose context uses the memory tracer and metrics. */
function instrumentedCaller(user: TestUser) {
  const requestContext = { ...testRequestContext(), userId: user.id };
  const tracer = createMemoryTracer().withContext(requestContext);
  const metrics = createMemoryMetrics();
  const context = {
    ...createAppContext(
      { id: user.id, email: user.email, name: user.name },
      requestContext
    ),
    tracer,
    storageReconcile: "off",
    metrics,
  };
  return { caller: appRouter.createCaller(context), context, tracer, metrics };
}

describe("metrics and tracing", () => {
  let user: TestUser;
  beforeAll(async () => {
    user = await signUp("Barbara Example", "barbara@example.test");
  });
  afterEach(() => vi.restoreAllMocks());

  it("makes an HTTP request a server span and one http.server.request.duration point, flushed when it ends", async () => {
    const spans = captureSpans();
    const points = captureDataPoints();

    const response = await withRequestContext(
      new Request(`${APP_URL}/api/files/9f4c17b6`, {
        headers: { "cf-ray": "8f02-AMS" },
      }),
      env,
      async () => new Response("not found", { status: 404 }),
      { route: "/api/files/[id]" }
    );

    const traceId = response.headers.get(REQUEST_ID_HEADER);
    expect(spans()).toEqual([
      expect.objectContaining({
        name: "GET /api/files/[id]",
        kind: "server",
        trace_id: traceId,
        status: { code: "unset" },
        attributes: expect.objectContaining({
          "http.request.method": "GET",
          "http.route": "/api/files/[id]",
          "http.response.status_code": 404,
          "url.path": "/api/files/9f4c17b6",
          "url.scheme": "http",
          "app.cloudflare.ray_id": "8f02-AMS",
        }),
        resource: expect.objectContaining({
          "service.name": "cloudflare-starter-web",
          "deployment.environment.name": "develop",
        }),
      }),
    ]);
    expect(points()).toEqual([
      expect.objectContaining({
        name: "http.server.request.duration",
        kind: "histogram",
        unit: "s",
        count: 1,
        attributes: {
          "http.request.method": "GET",
          "http.route": "/api/files/[id]",
          "http.response.status_code": "404",
          "url.scheme": "http",
        },
        resource: expect.objectContaining({
          "service.name": "cloudflare-starter-web",
          "deployment.environment.name": "develop",
        }),
      }),
    ]);
    // The raw path (and anything in it) never reaches a metric.
    expect(JSON.stringify(points())).not.toContain("9f4c17b6");
  });

  it("marks a request that failed with a 500 as an error span and error.type on the metric", async () => {
    const spans = captureSpans();
    const points = captureDataPoints();
    await withRequestContext(new Request(`${APP_URL}/boom`), env, async () => {
      throw new Error("render failed");
    });
    expect(spans()[0]).toMatchObject({
      name: "GET",
      status: { code: "error" },
      attributes: { "error.type": "500" },
      events: [
        {
          name: "exception",
          attributes: { "exception.message": "render failed" },
        },
      ],
    });
    expect(points()[0]?.attributes).toMatchObject({
      "http.response.status_code": "500",
      "error.type": "500",
    });
  });

  it("nests a tRPC procedure span under the request span, and flushes both metrics with the request", async () => {
    const spans = captureSpans();
    const points = captureDataPoints();
    const request = new Request(`${APP_URL}/api/trpc/health.hello`, {
      headers: { "x-trpc-source": "app" },
    });

    const response = await withRequestContext(
      request,
      env,
      async (scope) =>
        trpcPost({
          request,
          url: new URL(request.url),
          params: {},
          locals: {
            user: { id: user.id, email: user.email, name: user.name },
            requestContext: scope.setUserId(user.id),
          },
        } as unknown as APIContext),
      { route: "/api/trpc/[...trpc]" }
    );
    expect(response.status).toBe(200);

    const [procedure, server] = spans();
    expect(server).toMatchObject({
      kind: "server",
      trace_id: response.headers.get(REQUEST_ID_HEADER),
      attributes: { "user.id": user.id },
    });
    expect(procedure).toMatchObject({
      name: "health.hello",
      kind: "internal",
      trace_id: server?.trace_id,
      parent_span_id: server?.span_id,
      attributes: { "rpc.system.name": "trpc", "rpc.method": "health.hello" },
    });
    expect(points().map((point) => point.name)).toEqual([
      "rpc.server.call.duration",
      "http.server.request.duration",
    ]);
    expect(JSON.stringify(points())).not.toContain(user.id);
  });

  it("records a procedure call through the memory adapters: span, duration and error type", async () => {
    const { caller, tracer, metrics, context } = instrumentedCaller(user);

    await caller.storage.listFiles({ limit: 5 });
    await expect(caller.queue.enqueueHello({ name: "" })).rejects.toMatchObject(
      { code: "BAD_REQUEST" }
    );
    metrics.flush();

    expect(tracer.spans.map((span) => span.name)).toEqual([
      "storage.listFiles",
      "queue.enqueueHello",
    ]);
    for (const span of tracer.spans) {
      expect(span.trace_id).toBe(context.requestContext.traceId);
      expect(span.parent_span_id).toBe(context.requestContext.spanId);
    }
    expect(tracer.spans[1]?.attributes["error.type"]).toBe("BAD_REQUEST");
    expect(metrics.exported).toEqual([
      expect.objectContaining({
        name: "rpc.server.call.duration",
        attributes: {
          "rpc.system.name": "trpc",
          "rpc.method": "storage.listFiles",
        },
        count: 1,
      }),
      expect.objectContaining({
        name: "rpc.server.call.duration",
        attributes: {
          "rpc.system.name": "trpc",
          "rpc.method": "queue.enqueueHello",
          "error.type": "BAD_REQUEST",
        },
        count: 1,
      }),
    ]);
  });

  it("wraps an MCP tool call in a span with the request's trace id, its procedure span inside it", async () => {
    const { tracer, context } = instrumentedCaller(user);
    const handler = createMcpHandler(() =>
      buildMcpServer(callerInSpan(context), context)
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
          params: { name: "list_files", arguments: {} },
        }),
      })
    );
    expect(response.status).toBe(200);
    await response.text();

    const tool = tracer.spans.find(
      (span) => span.name === "tools/call list_files"
    );
    const procedure = tracer.spans.find(
      (span) => span.name === "storage.listFiles"
    );
    expect(tool).toMatchObject({
      trace_id: context.requestContext.traceId,
      parent_span_id: context.requestContext.spanId,
      attributes: {
        "mcp.method.name": "tools/call",
        "gen_ai.operation.name": "execute_tool",
        "gen_ai.tool.name": "list_files",
        "user.id": user.id,
      },
    });
    expect(procedure).toMatchObject({
      trace_id: context.requestContext.traceId,
      parent_span_id: tool?.span_id,
    });
  });
});
