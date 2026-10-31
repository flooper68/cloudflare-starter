import {
  createMemoryErrorReporter,
  createMemoryFeatureFlags,
  createMemoryJobQueue,
  createMemoryMetrics,
  createMemoryTracer,
  type JobQueue,
  noopBillingProvider,
  noopEmail,
  noopFeatureFlags,
  noopLogger,
  noopProductAnalytics,
  noopRateLimiter,
} from "@cloudflare-starter/features";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { describe, expect, it, vi } from "vitest";

import type { Context } from "@/server/trpc/init";

import { buildMcpServer, callerInSpan } from "./server";
import { MCP_TOOLS } from "./tools";

const REQUEST_CONTEXT: Context["requestContext"] = {
  traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
  spanId: "00f067aa0ba902b7",
  parentSpanId: null,
  traceFlags: "01",
  source: "http",
  userId: "user-1",
  workspaceId: null,
  ip: null,
  release: "local",
  environment: "local",
};

function context(overrides: Partial<Context> = {}): Context {
  return {
    tracer: createMemoryTracer().withContext(REQUEST_CONTEXT),
    metrics: createMemoryMetrics(),
    db: {} as Context["db"],
    clock: { now: () => new Date("2026-10-28T12:00:00.000Z") },
    ids: { uuid: () => "9f4c17b6-e154-4db2-b97b-08e09ec90f4e" },
    config: {
      security: {
        mode: "off",
        emailOtp: false,
        trustedDeviceDays: 0,
        passkeys: false,
      },
      APP_URL: "http://localhost:4321",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret",
      AUTH_EMAIL_PASSWORD: true,
      AUTH_REQUIRE_EMAIL_VERIFICATION: false,
      APP_ENV: "local",
      STORAGE_RECONCILE: "off",
      workspaces: {
        mode: "multi",
        signUp: "open",
        signUpDomains: [],
        bootstrapAdminEmail: null,
      },
      ADMIN_PORTAL: "on",
      billing: { mode: "off" },
    },
    email: { enabled: false, value: null, reason: "Email is not configured" },
    r2: { enabled: false, value: null, reason: "R2 is not configured" },
    jobQueue: createMemoryJobQueue(),
    notify: async () => ({ status: "nobody" }),
    emailOut: noopEmail,
    requestContext: REQUEST_CONTEXT,
    logger: noopLogger,
    errors: createMemoryErrorReporter(),
    bucket: {} as R2Bucket,
    flags: noopFeatureFlags,
    flagStore: null,
    rateLimiter: noopRateLimiter,
    analytics: noopProductAnalytics,
    billing: {
      requireFeature: async () => {},
      requireLimit: async () => {},
      recordUsage: async () => {},
      workspaceCreated: async () => {},
      planId: async () => "unlimited",
    },
    billingProvider: noopBillingProvider,
    user: { id: "user-1", email: "nicole@example.com", name: "Nicole" },
    session: null,
    browser: null,
    adminAuth: {} as Context["adminAuth"],
    accountAuth: { revokeSession: async () => {} },
    ...overrides,
  };
}

async function rpc(ctx: Context, method: string, params: unknown = {}) {
  const handler = createMcpHandler(() =>
    buildMcpServer(callerInSpan(ctx), ctx)
  );
  const response = await handler.fetch(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    })
  );
  const text = await response.text();
  // The response is JSON or a single SSE event, depending on negotiation.
  const json = text.startsWith("{")
    ? text
    : (text.split("\n").find((line) => line.startsWith("data: ")) ?? "").slice(
        6
      );
  return { status: response.status, body: JSON.parse(json) };
}

describe("MCP server", () => {
  it("lists every tool", async () => {
    const { body } = await rpc(context(), "tools/list");
    expect(
      body.result.tools.map((tool: { name: string }) => tool.name).sort()
    ).toEqual(MCP_TOOLS.map((tool) => tool.name).sort());
  });

  it("calls a procedure as the token's user", async () => {
    const { body } = await rpc(context(), "tools/call", {
      name: "whoami",
      arguments: {},
    });
    expect(body.result.structuredContent).toEqual({
      message: "hello world",
      user: "nicole@example.com",
      environment: "local",
    });
  });

  it("calls tools whose input fields are all optional with no arguments", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    // resolveActor's select(...).from(...).where(...).orderBy(...).limit(1)
    const membership = [{ workspaceId: "ws-1", role: "owner" }];
    const chain = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => Promise.resolve(membership),
    };
    const { body } = await rpc(
      context({
        db: {
          select: () => chain,
          query: { files: { findMany } },
        } as unknown as Context["db"],
      }),
      "tools/call",
      { name: "list_files", arguments: {} }
    );
    expect(body.result.isError).toBeUndefined();
    expect(body.result.structuredContent).toEqual({ items: [] });
  });

  it("turns tRPC errors into tool errors", async () => {
    const { body } = await rpc(context(), "tools/call", {
      name: "send_test_email",
      arguments: {},
    });
    expect(body.result.isError).toBe(true);
    expect(body.result.structuredContent.error.code).toBe(
      "PRECONDITION_FAILED"
    );
  });

  it("reports unexpected failures once and returns their reference", async () => {
    const errors = createMemoryErrorReporter();
    const send = vi.fn().mockRejectedValue(new Error("queue unavailable"));
    const { body } = await rpc(
      context({ errors, jobQueue: { send } as JobQueue }),
      "tools/call",
      { name: "enqueue_hello", arguments: { name: "Nicole" } }
    );
    expect(body.result.isError).toBe(true);
    expect(body.result.structuredContent.error).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      httpStatus: 500,
      message: "Internal error",
      reference: "4bf92f3577b34da6a3ce929d0e0e4736",
    });
    expect(errors.captured).toHaveLength(1);
    expect(errors.captured[0]?.extra).toEqual({
      "rpc.system.name": "trpc",
      "rpc.method": "queue.enqueueHello",
      "app.trpc.type": "mutation",
    });
  });

  it("reports a rate-limited tool call with how long to wait", async () => {
    const { body } = await rpc(
      context({
        rateLimiter: {
          limit: async () => ({ ok: false, retryAfterSeconds: 60 }),
        },
      }),
      "tools/call",
      { name: "enqueue_hello", arguments: { name: "Ada" } }
    );
    expect(body.result.isError).toBe(true);
    expect(body.result.structuredContent.error).toEqual({
      code: "TOO_MANY_REQUESTS",
      httpStatus: 429,
      message: "Too many requests. Try again in 60 seconds.",
      retryAfterSeconds: 60,
      // The DomainError's code and kind, as for every domain error (tRPC data.domain).
      appCode: "RATE_LIMITED",
      domain: { kind: "rate_limited" },
    });
  });

  it("returns client flags only to signed-in users", async () => {
    const { body } = await rpc(context({ user: null }), "tools/call", {
      name: "get_client_flags",
      arguments: {},
    });
    expect(body.result.structuredContent.error.code).toBe("UNAUTHORIZED");
  });

  // Non-admins (the role is read from D1) are covered in test/api/admin.test.ts.
  it("hides the flag admin tools from anonymous callers", async () => {
    const memory = createMemoryFeatureFlags();
    const { body } = await rpc(
      context({ user: null, flags: memory, flagStore: memory }),
      "tools/call",
      { name: "list_feature_flags", arguments: {} }
    );
    expect(body.result.structuredContent.error.code).toBe("NOT_FOUND");
  });

  it("wraps each tool call in a span on the request's trace, with the procedure span inside it", async () => {
    const tracer = createMemoryTracer().withContext(REQUEST_CONTEXT);
    const metrics = createMemoryMetrics();
    await rpc(context({ tracer, metrics }), "tools/call", {
      name: "whoami",
      arguments: {},
    });
    const [procedure, tool] = tracer.spans;
    expect(tool).toMatchObject({
      name: "tools/call whoami",
      trace_id: REQUEST_CONTEXT.traceId,
      parent_span_id: REQUEST_CONTEXT.spanId,
      attributes: {
        "mcp.method.name": "tools/call",
        "gen_ai.tool.name": "whoami",
      },
    });
    expect(procedure).toMatchObject({
      name: "health.hello",
      trace_id: REQUEST_CONTEXT.traceId,
      parent_span_id: tool?.span_id,
      attributes: { "rpc.system.name": "trpc", "rpc.method": "health.hello" },
    });
    metrics.flush();
    expect(metrics.exported).toEqual([
      expect.objectContaining({
        name: "rpc.server.call.duration",
        attributes: { "rpc.system.name": "trpc", "rpc.method": "health.hello" },
        count: 1,
      }),
    ]);
  });

  it("marks the tool span with the error type of a failed call", async () => {
    const tracer = createMemoryTracer().withContext(REQUEST_CONTEXT);
    await rpc(context({ tracer, user: null }), "tools/call", {
      name: "whoami",
      arguments: {},
    });
    expect(tracer.spans.map((span) => span.attributes["error.type"])).toEqual([
      "UNAUTHORIZED",
      "UNAUTHORIZED",
    ]);
  });

  it("refuses protected tools without a user", async () => {
    const { body } = await rpc(context({ user: null }), "tools/call", {
      name: "whoami",
      arguments: {},
    });
    expect(body.result.structuredContent.error.code).toBe("UNAUTHORIZED");
  });
});
