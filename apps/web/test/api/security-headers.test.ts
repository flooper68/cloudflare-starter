/**
 * Security headers on every response the Worker serves, through the real middleware
 * (server/app-middleware.ts) and the real routes: pages, redirects, API, /mcp, auth,
 * health, errors, and the CSP report endpoint. Static assets get theirs from
 * public/_headers (src/server/security-headers.test.ts checks the file).
 */
import { RATE_LIMIT_POLICIES } from "@cloudflare-starter/features";
import type { APIContext } from "astro";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ALL as authRoute } from "@/pages/api/auth/[...all]";
import { POST as cspReportRoute } from "@/pages/api/csp-report";
import { GET as helloRoute } from "@/pages/api/hello";
import { GET as liveRoute } from "@/pages/health/live";
import { ALL as mcpRoute } from "@/pages/mcp";
import {
  handleAppRequest,
  type MiddlewareContext,
} from "@/server/app-middleware";
import type { AppEnv } from "@/server/env";
import { NON_HTML_CSP } from "@/server/security-headers";

import { APP_URL, env } from "./helpers";

type Route = (context: APIContext) => Response | Promise<Response>;

/** What Astro's `security.csp` puts on a rendered page. */
const ASTRO_POLICY =
  "script-src 'self' 'sha256-island='; style-src 'self' 'sha256-css=';";

const page: Route = () =>
  new Response("<!doctype html><title>x</title>", {
    headers: {
      "content-type": "text/html",
      "content-security-policy": ASTRO_POLICY,
    },
  });

/** Runs a request through the middleware and then `route`, as Astro does. */
async function serve(
  request: Request,
  route: Route = page,
  runtimeEnv: AppEnv = env
): Promise<Response> {
  const context: MiddlewareContext = {
    request,
    url: new URL(request.url),
    isPrerendered: false,
    locals: {} as MiddlewareContext["locals"],
    redirect: (path: string, status = 302) =>
      Response.redirect(new URL(path, request.url), status as 302),
    routePattern: new URL(request.url).pathname,
  };
  return handleAppRequest(context, runtimeEnv, async () =>
    route({
      request,
      url: context.url,
      params: {},
      locals: context.locals,
    } as unknown as APIContext)
  );
}

const BASE_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "x-frame-options": "DENY",
  "x-permitted-cross-domain-policies": "none",
};

function expectBaseHeaders(response: Response) {
  for (const [name, value] of Object.entries(BASE_HEADERS)) {
    expect(response.headers.get(name), name).toBe(value);
  }
  expect(response.headers.get("permissions-policy")).toContain("camera=()");
  expect(response.headers.get("permissions-policy")).toContain(
    "publickey-credentials-get=(self)"
  );
}

function directive(
  response: Response,
  name: string,
  header = "content-security-policy"
) {
  const policy = response.headers.get(header) ?? "";
  return policy
    .split(";")
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));
}

const deployedEnv: AppEnv = { ...env, APP_ENV: "production" };
const reportOnlyEnv: AppEnv = { ...env, CSP_MODE: "report-only" };
const misconfiguredEnv: AppEnv = { ...env, CSP_MODE: undefined };
const analyticsEnv: AppEnv = {
  ...env,
  WEB_ANALYTICS: "cloudflare",
  WEB_ANALYTICS_TOKEN: "0123abcd",
};
const presignEnv: AppEnv = {
  ...env,
  R2_ACCOUNT_ID: "acct123",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_FILES_BUCKET_NAME: "files-test",
} as AppEnv;

describe("HTML pages", () => {
  it("get the enforced page policy with Astro's hashes and Turnstile", async () => {
    const response = await serve(new Request(`${APP_URL}/sign-in`));
    expect(response.status).toBe(200);
    expectBaseHeaders(response);
    expect(directive(response, "script-src")).toBe(
      `script-src ${APP_URL}/_astro/ 'sha256-island=' https://challenges.cloudflare.com`
    );
    expect(directive(response, "style-src")).toBe(
      "style-src 'self' 'unsafe-inline'"
    );
    expect(directive(response, "frame-src")).toBe(
      "frame-src https://challenges.cloudflare.com"
    );
    expect(directive(response, "frame-ancestors")).toBe(
      "frame-ancestors 'none'"
    );
    expect(directive(response, "object-src")).toBe("object-src 'none'");
    expect(directive(response, "report-uri")).toBe(
      `report-uri ${APP_URL}/api/csp-report`
    );
    expect(response.headers.get("reporting-endpoints")).toBe(
      `csp-endpoint="${APP_URL}/api/csp-report"`
    );
    expect(directive(response, "script-src")).not.toContain("unsafe-inline");
    // Local over plain HTTP: no HSTS, no upgrade.
    expect(response.headers.get("strict-transport-security")).toBeNull();
    expect(directive(response, "upgrade-insecure-requests")).toBeUndefined();
  });

  it("get HSTS and upgrade-insecure-requests when deployed over HTTPS", async () => {
    const response = await serve(
      new Request("https://starter.example/"),
      page,
      deployedEnv
    );
    expect(response.headers.get("strict-transport-security")).toBe(
      "max-age=31536000; includeSubDomains"
    );
    expect(directive(response, "upgrade-insecure-requests")).toBe(
      "upgrade-insecure-requests"
    );
    expect(directive(response, "script-src")).toContain(
      "https://starter.example/_astro/"
    );
  });

  it("are only reported with CSP_MODE=report-only, keeping the safe baseline enforced", async () => {
    const response = await serve(
      new Request(`${APP_URL}/`),
      page,
      reportOnlyEnv
    );
    expect(response.headers.get("content-security-policy")).toBe(
      "frame-ancestors 'none'; object-src 'none'; base-uri 'self'"
    );
    expect(
      directive(response, "script-src", "content-security-policy-report-only")
    ).toContain("'sha256-island='");
  });

  it("allow the Web Analytics beacon only with WEB_ANALYTICS=cloudflare", async () => {
    const plain = await serve(new Request(`${APP_URL}/`));
    expect(plain.headers.get("content-security-policy")).not.toContain(
      "cloudflareinsights"
    );
    const response = await serve(
      new Request(`${APP_URL}/`),
      page,
      analyticsEnv
    );
    expect(directive(response, "script-src")).toContain(
      "https://static.cloudflareinsights.com"
    );
    expect(directive(response, "connect-src")).toBe(
      "connect-src 'self' https://cloudflareinsights.com"
    );
  });

  it("may connect to the R2 bucket endpoint only when presigned uploads are configured", async () => {
    const response = await serve(
      new Request(`${APP_URL}/app/dashboard`),
      page,
      presignEnv
    );
    // Signed out: the guard redirects, and the redirect carries the headers too.
    expect(response.status).toBe(302);
    expectBaseHeaders(response);
    const signedIn = await serve(new Request(`${APP_URL}/`), page, presignEnv);
    expect(directive(signedIn, "connect-src")).toBe(
      "connect-src 'self' https://acct123.r2.cloudflarestorage.com/files-test/"
    );
  });

  it("are enforced with the strictest policy when a setting is missing", async () => {
    const response = await serve(
      new Request(`${APP_URL}/`),
      page,
      misconfiguredEnv
    );
    // The edge answers 500 (Server Misconfigured) as JSON: the non-page policy.
    expect(response.status).toBe(500);
    expectBaseHeaders(response);
    expect(response.headers.get("content-security-policy")).toBe(NON_HTML_CSP);
  });
});

describe("non-HTML responses", () => {
  it("API: /api/hello", async () => {
    const response = await serve(
      new Request(`${APP_URL}/api/hello`),
      helloRoute as Route
    );
    expect(response.status).toBe(200);
    expectBaseHeaders(response);
    expect(response.headers.get("content-security-policy")).toBe(NON_HTML_CSP);
  });

  it("auth: /api/auth/get-session", async () => {
    const response = await serve(
      new Request(`${APP_URL}/api/auth/get-session`),
      authRoute as Route
    );
    expect(response.status).toBe(200);
    expectBaseHeaders(response);
    expect(response.headers.get("content-security-policy")).toBe(NON_HTML_CSP);
  });

  it("MCP: OPTIONS and an unauthenticated POST", async () => {
    for (const method of ["OPTIONS", "POST"]) {
      const response = await serve(
        new Request(`${APP_URL}/mcp`, {
          method,
          headers: { "content-type": "application/json" },
          body: method === "POST" ? "{}" : undefined,
        }),
        mcpRoute as Route
      );
      expectBaseHeaders(response);
      expect(response.headers.get("content-security-policy"), method).toBe(
        NON_HTML_CSP
      );
    }
  });

  it("health: /health/live keeps no-store", async () => {
    const response = await serve(
      new Request(`${APP_URL}/health/live`),
      liveRoute as Route
    );
    expect(response.status).toBe(200);
    expectBaseHeaders(response);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-security-policy")).toBe(NON_HTML_CSP);
  });

  it("user files served as HTML are data, not pages", async () => {
    const response = await serve(
      new Request(`${APP_URL}/api/files/f1`),
      () =>
        new Response("<script>alert(1)</script>", {
          headers: { "content-type": "text/html" },
        })
    );
    expect(response.headers.get("content-security-policy")).toBe(NON_HTML_CSP);
  });
});

describe("/api/csp-report", () => {
  afterEach(() => vi.restoreAllMocks());

  const report = (ip: string, body: string, type = "application/csp-report") =>
    new Request(`${APP_URL}/api/csp-report`, {
      method: "POST",
      headers: { "content-type": type, "cf-connecting-ip": ip },
      body,
    });

  it("logs a violation without query strings and answers 204", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await serve(
      report(
        "198.51.100.71",
        JSON.stringify({
          "csp-report": {
            "document-uri": `${APP_URL}/sign-in?next=/app`,
            "effective-directive": "script-src-elem",
            "blocked-uri": "https://evil.example/x.js?token=secret",
            disposition: "enforce",
          },
        })
      ),
      cspReportRoute as Route
    );
    expect(response.status).toBe(204);
    expectBaseHeaders(response);
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain("csp.violation");
    expect(logged).toContain("https://evil.example/x.js");
    expect(logged).not.toContain("secret");
    expect(logged).not.toContain("next=");
  });

  it("accepts Reporting API batches", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await serve(
      report(
        "198.51.100.72",
        JSON.stringify([
          {
            type: "csp-violation",
            body: {
              documentURL: `${APP_URL}/`,
              effectiveDirective: "img-src",
              blockedURL: "https://img.example/a.png",
              disposition: "report",
            },
          },
        ]),
        "application/reports+json"
      ),
      cspReportRoute as Route
    );
    expect(response.status).toBe(204);
  });

  it("refuses other media types, oversized and malformed bodies", async () => {
    const send = (request: Request) => serve(request, cspReportRoute as Route);
    expect(
      (await send(report("198.51.100.73", "{}", "text/plain"))).status
    ).toBe(415);
    expect(
      (await send(report("198.51.100.73", "x".repeat(17 * 1024)))).status
    ).toBe(413);
    expect((await send(report("198.51.100.73", "not json"))).status).toBe(400);
  });

  it("is limited per IP by csp.report", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { limit } = RATE_LIMIT_POLICIES["csp.report"];
    let last: Response | undefined;
    for (let attempt = 0; attempt < limit * 2 + 1; attempt += 1) {
      last = await serve(
        report("198.51.100.74", "{}"),
        cspReportRoute as Route
      );
      if (last.status === 429) break;
    }
    expect(last?.status).toBe(429);
    expect(last?.headers.get("retry-after")).toBeTruthy();
    expectBaseHeaders(last as Response);
  });
});
