/**
 * The health endpoints through their routes and the middleware, with the app's real
 * bindings: liveness, readiness in the IETF health check format, a failing dependency
 * injected through the env (the test seam: `healthResponse` takes the env), a missing
 * setting, the health.ip rate limit, spans per check, and the admin view over tRPC and
 * /mcp.
 */
import { env as workerEnv } from "cloudflare:workers";
import {
  createMemoryLogger,
  createMemoryTracer,
  HEALTH_CONTENT_TYPE,
  type HealthResponseBody,
  RATE_LIMIT_POLICIES,
  type RequestContext,
} from "@cloudflare-starter/features";
import { createMcpHandler } from "@modelcontextprotocol/server";
import type { APIContext } from "astro";
import { beforeAll, describe, expect, it } from "vitest";

import { GET as healthRoute } from "@/pages/health/index";
import { HEAD as liveHead, GET as liveRoute } from "@/pages/health/live";
import { HEAD as readyHead, GET as readyRoute } from "@/pages/health/ready";
import {
  handleAppRequest,
  type MiddlewareContext,
} from "@/server/app-middleware";
import type { AppEnv } from "@/server/env";
import {
  healthResponse,
  readinessProbes,
  readinessReport,
  runReadinessChecks,
} from "@/server/health";
import { REQUEST_ID_HEADER } from "@/server/http";
import { buildMcpServer } from "@/server/mcp/server";
import { buildPlatform } from "@/server/platform";

import {
  APP_URL,
  callerFor,
  signUp,
  type TestUser,
  testRequestContext,
} from "./helpers";

const env = workerEnv as AppEnv;
const CHECKS = [
  "d1:responseTime",
  "r2:responseTime",
  "queue:binding",
  "email:configuration",
  "settings:configuration",
  "rate-limits:bindings",
  "analytics-engine:bindings",
];

let nextIp = 0;
/** A request context from its own documentation-range IP, as the HTTP edge builds it. */
function fromNewIp(): RequestContext {
  nextIp += 1;
  return { ...testRequestContext(), ip: `192.0.2.${nextIp}` };
}

function route(path: string, method = "GET", context = fromNewIp()) {
  const request = new Request(`${APP_URL}${path}`, { method });
  return {
    request,
    url: new URL(request.url),
    params: {},
    locals: { user: null, requestContext: context },
  } as unknown as APIContext;
}

async function bodyOf(response: Response) {
  return (await response.json()) as HealthResponseBody;
}

function expectHealthHeaders(response: Response) {
  expect(response.headers.get("content-type")).toBe(HEALTH_CONTENT_TYPE);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("RateLimit-Policy")).toContain('"health.ip"');
}

describe("GET /health/live", () => {
  it("answers 200 pass with a tiny body", async () => {
    const response = await liveRoute(route("/health/live"));
    expect(response.status).toBe(200);
    expectHealthHeaders(response);
    expect(await response.json()).toEqual({ status: "pass" });
  });

  it("answers HEAD with the status and headers, no body", async () => {
    const response = await liveHead(route("/health/live", "HEAD"));
    expect(response.status).toBe(200);
    expectHealthHeaders(response);
    expect(await response.text()).toBe("");
  });

  it("passes even when a dependency is down: it touches none", async () => {
    const broken = { ...env, DB: undefined } as unknown as AppEnv;
    const response = await healthResponse(
      "live",
      new Request(`${APP_URL}/health/live`),
      broken,
      fromNewIp()
    );
    expect(response.status).toBe(200);
  });
});

describe("GET /health/ready", () => {
  it("answers 200 with every check passing, in the IETF health check format", async () => {
    const context = fromNewIp();
    const response = await readyRoute(route("/health/ready", "GET", context));
    expect(response.status).toBe(200);
    expectHealthHeaders(response);
    const body = await bodyOf(response);
    expect(body).toMatchObject({
      status: "pass",
      version: "1",
      // CF_VERSION_METADATA's id, as in the logs.
      releaseId: buildPlatform(env).release,
      serviceId: "cloudflare-starter-web",
      reference: context.traceId,
    });
    expect(Object.keys(body.checks)).toEqual(CHECKS);
    for (const name of CHECKS) {
      const [entry] = body.checks[name] ?? [];
      expect(entry, name).toMatchObject({ status: "pass" });
      expect(Date.parse(entry?.time ?? "")).not.toBeNaN();
    }
    expect(body.checks["d1:responseTime"]?.[0]).toMatchObject({
      componentType: "datastore",
      observedUnit: "ms",
      observedValue: expect.any(Number),
    });
  });

  it("answers /health as an alias of /health/ready", async () => {
    const response = await healthRoute(route("/health"));
    expect(response.status).toBe(200);
    expectHealthHeaders(response);
    expect(Object.keys((await bodyOf(response)).checks)).toEqual(CHECKS);
  });

  it("answers HEAD with the readiness status and no body", async () => {
    const response = await readyHead(route("/health/ready", "HEAD"));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });

  it("answers 503 fail when D1 is down, without the error in the body", async () => {
    const broken = {
      ...env,
      DB: {
        prepare() {
          throw new Error("D1_ERROR: internal error at db-host.internal:5432");
        },
      } as unknown as D1Database,
    };
    const context = fromNewIp();
    const response = await healthResponse(
      "ready",
      new Request(`${APP_URL}/health/ready`),
      broken,
      context
    );
    expect(response.status).toBe(503);
    expectHealthHeaders(response);
    const text = await response.text();
    expect(text).not.toContain("db-host");
    expect(text).not.toContain("D1_ERROR");
    const body = JSON.parse(text) as HealthResponseBody;
    expect(body).toMatchObject({
      status: "fail",
      output: "1 of 7 checks failed",
      reference: context.traceId,
    });
    expect(body.checks["d1:responseTime"]?.[0]).toMatchObject({
      status: "fail",
      output: "error",
    });
    expect(body.checks["r2:responseTime"]?.[0]).toMatchObject({
      status: "pass",
    });
  });

  it("shows the failure's detail only in the admin view", async () => {
    const broken = { ...env, APP_QUEUE: undefined } as AppEnv;
    const publicBody = await readinessReport(broken, fromNewIp());
    const adminBody = await readinessReport(broken, fromNewIp(), {
      detail: true,
    });
    expect(publicBody.checks["queue:binding"]?.[0]?.output).toBe(
      "missing binding"
    );
    expect(adminBody.checks["queue:binding"]?.[0]?.output).toBe(
      "missing binding: not bound: APP_QUEUE"
    );
    expect(adminBody.checks["settings:configuration"]?.[0]?.output).toContain(
      "APP_QUEUE"
    );
  });

  it("fails a check that does not answer in time", async () => {
    const d1 = readinessProbes(env).filter(
      (probe) => probe.name === "d1:responseTime"
    );
    const response = await healthResponse(
      "ready",
      new Request(`${APP_URL}/health/ready`),
      env,
      fromNewIp(),
      {
        probes: [
          ...d1,
          {
            name: "r2:responseTime",
            componentType: "datastore",
            measured: true,
            run: () => new Promise(() => {}),
          },
        ],
        timeoutMs: 50,
      }
    );
    expect(response.status).toBe(503);
    expect(
      (await bodyOf(response)).checks["r2:responseTime"]?.[0]
    ).toMatchObject({ status: "fail", output: "timeout" });
  });

  it("warns, still 200, when mail is not configured", async () => {
    const response = await healthResponse(
      "ready",
      new Request(`${APP_URL}/health/ready`),
      { ...env, EMAIL_FROM: undefined },
      fromNewIp()
    );
    expect(response.status).toBe(200);
    const body = await bodyOf(response);
    expect(body.status).toBe("warn");
    expect(body.checks["email:configuration"]?.[0]).toMatchObject({
      status: "warn",
      output: "not configured",
    });
  });

  it("records one span per check, an error span for a failed one, and logs the detail", async () => {
    const context = fromNewIp();
    const tracer = createMemoryTracer().withContext(context);
    const logger = createMemoryLogger();
    await runReadinessChecks(
      readinessProbes({ ...env, APP_QUEUE: undefined }),
      { tracer, logger: logger.withContext(context) }
    );
    expect(tracer.spans.map((span) => span.name).sort()).toEqual(
      CHECKS.map((name) => `health.check ${name}`).sort()
    );
    for (const span of tracer.spans) {
      expect(span.trace_id).toBe(context.traceId);
      expect(span.parent_span_id).toBe(context.spanId);
      expect(span.kind).toBe("internal");
    }
    const queue = tracer.spans.find(
      (span) => span.name === "health.check queue:binding"
    );
    expect(queue?.status).toMatchObject({ code: "error" });
    expect(queue?.attributes).toMatchObject({ "app.health.status": "fail" });
    expect(logger.records).toContainEqual(
      expect.objectContaining({
        body: "health.check_failed",
        trace_id: context.traceId,
        attributes: expect.objectContaining({
          "app.health.check": "queue:binding",
          "app.health.detail": "not bound: APP_QUEUE",
        }),
      })
    );
  });
});

describe("health through the middleware", () => {
  function middlewareContext(path: string): MiddlewareContext {
    const request = new Request(`${APP_URL}${path}`, {
      // A cookie the middleware must not look up: health paths need no session.
      headers: { cookie: "better-auth.session_token=not-a-session" },
    });
    return {
      request,
      url: new URL(request.url),
      isPrerendered: false,
      locals: {} as MiddlewareContext["locals"],
      redirect: () => new Response(null, { status: 302 }),
      routePattern: path,
    };
  }

  const misconfigured = { ...env, RATE_LIMITING: undefined } as AppEnv;

  it("answers liveness 200 even when a setting is missing", async () => {
    const context = middlewareContext("/health/live");
    const response = await handleAppRequest(context, misconfigured, () =>
      healthResponse(
        "live",
        context.request,
        misconfigured,
        context.locals.requestContext
      )
    );
    expect(response.status).toBe(200);
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe(
      context.locals.requestContext.traceId
    );
    expect(context.locals.user).toBeNull();
  });

  it("answers readiness 503 with the settings check failed when a setting is missing", async () => {
    const context = middlewareContext("/health/ready");
    const response = await handleAppRequest(context, misconfigured, () =>
      healthResponse(
        "ready",
        context.request,
        misconfigured,
        context.locals.requestContext
      )
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toBe(HEALTH_CONTENT_TYPE);
    const text = await response.text();
    expect(text).not.toContain("RATE_LIMITING");
    const body = JSON.parse(text) as HealthResponseBody;
    expect(body.checks["settings:configuration"]?.[0]).toMatchObject({
      status: "fail",
      output: "error",
    });
    expect(body.reference).toBe(context.locals.requestContext.traceId);
  });
});

describe("health.ip", () => {
  it("answers 429 with Retry-After and the RateLimit fields past the limit", async () => {
    const { limit } = RATE_LIMIT_POLICIES["health.ip"];
    const context = fromNewIp();
    let refused: Response | undefined;
    for (let call = 1; call <= limit * 2 + 1 && !refused; call++) {
      const response = await liveRoute(route("/health/live", "GET", context));
      if (response.status === 429) refused = response;
    }
    expect(refused?.status).toBe(429);
    expect(refused?.headers.get("content-type")).toBe(
      "application/problem+json"
    );
    expect(refused?.headers.get("cache-control")).toBe("no-store");
    expect(Number(refused?.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(refused?.headers.get("RateLimit")).toContain("r=0");
    expect(await refused?.json()).toMatchObject({
      status: 429,
      "violated-policies": ["health.ip"],
    });
    // Another client is not affected.
    expect((await liveRoute(route("/health/live"))).status).toBe(200);
  });
});

describe("admin.health.get", () => {
  let admin: TestUser;
  beforeAll(async () => {
    admin = await signUp("Ada Admin", "ada@health.test");
    await env.DB.prepare("UPDATE user SET role = 'admin' WHERE id = ?")
      .bind(admin.id)
      .run();
  });

  it("returns the readiness report to a platform admin", async () => {
    const report = await callerFor(admin).admin.health.get();
    expect(report.status).toBe("pass");
    expect(Object.keys(report.checks)).toEqual(CHECKS);
  });

  it("is NOT_FOUND for anyone else", async () => {
    await expect(callerFor(null).admin.health.get()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("works through /mcp as admin_get_health", async () => {
    const caller = callerFor(admin);
    const handler = createMcpHandler(() =>
      buildMcpServer(() => caller, {
        errors: buildPlatform(env).errors,
        tracer: buildPlatform(env).tracer.withContext(testRequestContext()),
        requestContext: testRequestContext(),
      })
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
          params: { name: "admin_get_health", arguments: {} },
        }),
      })
    );
    const text = await response.text();
    const json = text.startsWith("{")
      ? text
      : (
          text.split("\n").find((line) => line.startsWith("data: ")) ?? ""
        ).slice(6);
    const result = JSON.parse(json).result as {
      isError?: boolean;
      structuredContent: { status: string };
    };
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent.status).toBe("pass");
  });
});
