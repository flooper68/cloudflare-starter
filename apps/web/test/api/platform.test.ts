// The platform edge: request ids on every response, references on internal errors (tRPC,
// MCP tools, file routes), and the named error when a platform setting is missing.
import { env } from "cloudflare:workers";
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
import { REQUEST_ID_HEADER, withRequestContext } from "@/server/http";
import { buildMcpServer } from "@/server/mcp/server";

import {
  APP_URL,
  callerFor,
  signUp,
  type TestUser,
  testRequestContext,
} from "./helpers";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Error reports written to Workers Logs (LOG_SINK/ERROR_REPORTER are workers-logs here). */
function captureReports() {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  return () =>
    spy.mock.calls
      .map(([record]) => record as Record<string, unknown>)
      .filter((record) => record?.event === "error.captured");
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

describe("platform edge (request ids and error references)", () => {
  let user: TestUser;
  beforeAll(async () => {
    user = await signUp("Nicole Example", "nicole@example.test");
  });
  afterEach(() => vi.restoreAllMocks());

  it("gives every response a server-generated x-request-id", async () => {
    const ok = await withRequestContext(
      new Request(`${APP_URL}/api/hello`, {
        headers: { [REQUEST_ID_HEADER]: "client-chosen-id" },
      }),
      env,
      async () => new Response("ok")
    );
    const id = ok.headers.get(REQUEST_ID_HEADER);
    expect(id).toMatch(UUID);
    expect(id).not.toBe("client-chosen-id");

    // Responses with immutable headers (redirects, fetched responses) are copied.
    const redirect = await withRequestContext(
      new Request(`${APP_URL}/app`),
      env,
      async () => Response.redirect(`${APP_URL}/sign-in`, 302)
    );
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get(REQUEST_ID_HEADER)).toMatch(UUID);
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

    it("gives /mcp a request context and an x-request-id before its early return", async () => {
      const context = middlewareContext("/mcp");
      const response = await handleAppRequest(
        context,
        env,
        async () => new Response(null, { status: 401 })
      );
      expect(response.headers.get(REQUEST_ID_HEADER)).toBe(
        context.locals.requestContext.requestId
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
      expect(redirect.headers.get(REQUEST_ID_HEADER)).toMatch(UUID);

      const signedIn = middlewareContext("/app/dashboard", user.cookie);
      const page = await handleAppRequest(
        signedIn,
        env,
        async () => new Response("dashboard")
      );
      expect(page.status).toBe(200);
      expect(signedIn.locals.requestContext.userId).toBe(user.id);
      expect(page.headers.get(REQUEST_ID_HEADER)).toBe(
        signedIn.locals.requestContext.requestId
      );
    });
  });

  it("turns an unhandled error into a 500 whose reference is the request id", async () => {
    const reports = captureReports();
    const response = await withRequestContext(
      new Request(`${APP_URL}/boom`, { headers: { "cf-ray": "8f00-AMS" } }),
      env,
      async () => {
        throw new Error("render failed");
      }
    );
    expect(response.status).toBe(500);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({
      error: "Internal error",
      reference: response.headers.get(REQUEST_ID_HEADER),
    });
    expect(reports()).toEqual([
      expect.objectContaining({
        requestId: body.reference,
        source: "http",
        cfRay: "8f00-AMS",
        path: "/boom",
        error: expect.objectContaining({ message: "render failed" }),
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
    expect(header).toMatch(UUID);
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
        requestId: header,
        userId: user.id,
        procedure: "queue.enqueueHello",
        error: expect.objectContaining({ message: "queue unavailable" }),
      }),
    ]);
  });

  it("gives expected tRPC errors no reference", async () => {
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
  });

  it("returns the reference in an MCP tool error", async () => {
    vi.spyOn(env.APP_QUEUE as Queue, "send").mockRejectedValue(
      new Error("queue unavailable")
    );
    const reports = captureReports();
    const requestContext = testRequestContext();
    const caller = callerFor(user, requestContext);
    const context = { errors: { capture: vi.fn() }, requestContext };
    const handler = createMcpHandler(() => buildMcpServer(caller, context));
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
      reference: requestContext.requestId,
    });
    // Reported once, by the procedure, not again by the tool wrapper.
    expect(context.errors.capture).not.toHaveBeenCalled();
    expect(reports()).toEqual([
      expect.objectContaining({ requestId: requestContext.requestId }),
    ]);
  });

  it("answers a failed file upload with 500 and the reference", async () => {
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
      headers: { origin: APP_URL },
    });
    const requestContext = testRequestContext();

    const response = await uploadFile(
      routeContext(request, user, requestContext)
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Internal error",
      reference: requestContext.requestId,
    });
    expect(reports()).toEqual([
      expect.objectContaining({
        requestId: requestContext.requestId,
        route: "POST /api/files",
      }),
    ]);
  });

  it("fails with an error naming LOG_SINK when the setting is missing", async () => {
    const handle = vi.fn(async () => new Response("never"));
    const misconfigured = { ...env, LOG_SINK: undefined } as AppEnv;
    const response = await withRequestContext(
      new Request(`${APP_URL}/api/hello`),
      misconfigured,
      handle
    );
    expect(handle).not.toHaveBeenCalled();
    expect(response.status).toBe(500);
    const body = (await response.json()) as Record<string, string>;
    expect(body.error).toMatch(
      /^LOG_SINK is not set: set LOG_SINK to one of workers-logs, none/
    );
    expect(body.reference).toBe(response.headers.get(REQUEST_ID_HEADER));
  });
});
