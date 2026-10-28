import {
  createMemoryErrorReporter,
  createMemoryFeatureFlags,
  createMemoryJobQueue,
  type JobQueue,
  noopFeatureFlags,
  noopLogger,
} from "@cloudflare-starter/features";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { describe, expect, it, vi } from "vitest";

import type { Context } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/router";

import { buildMcpServer } from "./server";
import { MCP_TOOLS } from "./tools";

function context(overrides: Partial<Context> = {}): Context {
  return {
    db: {} as Context["db"],
    clock: { now: () => new Date("2026-10-28T12:00:00.000Z") },
    ids: { uuid: () => "9f4c17b6-e154-4db2-b97b-08e09ec90f4e" },
    config: {
      APP_URL: "http://localhost:4321",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret",
      AUTH_EMAIL_PASSWORD: true,
      AUTH_REQUIRE_EMAIL_VERIFICATION: false,
      APP_ENV: "local",
      workspaces: {
        mode: "multi",
        signUp: "open",
        signUpDomains: [],
        bootstrapAdminEmail: null,
      },
    },
    email: { enabled: false, value: null, reason: "Email is not configured" },
    r2: { enabled: false, value: null, reason: "R2 is not configured" },
    jobQueue: createMemoryJobQueue(),
    requestContext: {
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
    },
    logger: noopLogger,
    errors: createMemoryErrorReporter(),
    bucket: {} as R2Bucket,
    flags: noopFeatureFlags,
    flagStore: null,
    user: { id: "user-1", email: "nicole@example.com", name: "Nicole" },
    ...overrides,
  };
}

async function rpc(ctx: Context, method: string, params: unknown = {}) {
  const handler = createMcpHandler(() =>
    buildMcpServer(appRouter.createCaller(ctx), ctx)
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
      "rpc.system": "trpc",
      "rpc.method": "queue.enqueueHello",
      "app.trpc.type": "mutation",
    });
  });

  it("returns client flags only to signed-in users", async () => {
    const { body } = await rpc(context({ user: null }), "tools/call", {
      name: "get_client_flags",
      arguments: {},
    });
    expect(body.result.structuredContent.error.code).toBe("UNAUTHORIZED");
  });

  it("hides the flag admin tools from users without the admin role", async () => {
    const memory = createMemoryFeatureFlags();
    const { body } = await rpc(
      context({ flags: memory, flagStore: memory }),
      "tools/call",
      { name: "list_feature_flags", arguments: {} }
    );
    expect(body.result.structuredContent.error.code).toBe("NOT_FOUND");
  });

  it("refuses protected tools without a user", async () => {
    const { body } = await rpc(context({ user: null }), "tools/call", {
      name: "whoami",
      arguments: {},
    });
    expect(body.result.structuredContent.error.code).toBe("UNAUTHORIZED");
  });
});
