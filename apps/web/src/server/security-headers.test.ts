import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  baseSecurityHeaders,
  CSP_REPORT_GROUP,
  hashesOf,
  isAppPage,
  NON_HTML_CSP,
  PAGEFIND_CSP,
  type PagePolicyInput,
  PRERENDERED_PAGE_CSP,
  PRERENDERED_PAGE_PATHS,
  pagePolicy,
  pagePolicyHeaders,
  presignedUploadOrigin,
  REPORT_ONLY_BASELINE_CSP,
  renderStaticHeaders,
  type SecurityHeaderSettings,
  securityHeadersFor,
} from "./security-headers";
import { STATIC_HTML_PATHS } from "./static-cache";

const ORIGIN = "https://starter.example";

const deployed: PagePolicyInput = {
  origin: ORIGIN,
  dev: false,
  deployed: true,
  turnstile: false,
  webAnalytics: false,
  uploadOrigin: null,
  scriptHashes: ["'sha256-script='"],
};

/** The directive `name` of a policy as its list of sources. */
function directive(policy: string, name: string): string[] | undefined {
  for (const part of policy.split(";")) {
    const [first, ...sources] = part.trim().split(/\s+/);
    if (first === name) return sources;
  }
  return undefined;
}

describe("page policy", () => {
  it("is strict by default: hashed inline code and our bundles only", () => {
    const policy = pagePolicy(deployed);
    expect(directive(policy, "default-src")).toEqual(["'self'"]);
    expect(directive(policy, "script-src")).toEqual([
      `${ORIGIN}/_astro/`,
      "'sha256-script='",
    ]);
    expect(directive(policy, "script-src-attr")).toEqual(["'none'"]);
    // Styles: inline allowed (Radix computes them at runtime), so no hashes.
    expect(directive(policy, "style-src")).toEqual([
      "'self'",
      "'unsafe-inline'",
    ]);
    expect(directive(policy, "object-src")).toEqual(["'none'"]);
    expect(directive(policy, "base-uri")).toEqual(["'self'"]);
    expect(directive(policy, "form-action")).toEqual(["'self'"]);
    expect(directive(policy, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(policy, "frame-src")).toEqual(["'none'"]);
    expect(directive(policy, "connect-src")).toEqual(["'self'"]);
    expect(directive(policy, "img-src")).toEqual(["'self'", "data:"]);
    expect(directive(policy, "upgrade-insecure-requests")).toEqual([]);
    expect(directive(policy, "report-uri")).toEqual([
      `${ORIGIN}/api/csp-report`,
    ]);
    expect(directive(policy, "report-to")).toEqual([CSP_REPORT_GROUP]);
    expect(directive(policy, "script-src")?.join(" ")).not.toContain(
      "unsafe-inline"
    );
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).not.toContain("*");
  });

  it("allows Turnstile's script and frame only with TURNSTILE=on", () => {
    const policy = pagePolicy({ ...deployed, turnstile: true });
    expect(directive(policy, "script-src")).toContain(
      "https://challenges.cloudflare.com"
    );
    expect(directive(policy, "frame-src")).toEqual([
      "https://challenges.cloudflare.com",
    ]);
    expect(pagePolicy(deployed)).not.toContain("challenges.cloudflare.com");
  });

  it("allows the Web Analytics beacon only with WEB_ANALYTICS=cloudflare", () => {
    const policy = pagePolicy({ ...deployed, webAnalytics: true });
    expect(directive(policy, "script-src")).toContain(
      "https://static.cloudflareinsights.com"
    );
    expect(directive(policy, "connect-src")).toEqual([
      "'self'",
      "https://cloudflareinsights.com",
    ]);
    expect(pagePolicy(deployed)).not.toContain("cloudflareinsights");
  });

  it("allows the R2 bucket endpoint only when presigned uploads are configured", () => {
    const uploadOrigin = presignedUploadOrigin({
      accountId: "abc123",
      filesBucketName: "files-production",
    });
    expect(uploadOrigin).toBe(
      "https://abc123.r2.cloudflarestorage.com/files-production/"
    );
    expect(
      directive(pagePolicy({ ...deployed, uploadOrigin }), "connect-src")
    ).toEqual(["'self'", uploadOrigin]);
  });

  it("upgrades insecure requests only when deployed", () => {
    expect(pagePolicy({ ...deployed, deployed: false })).not.toContain(
      "upgrade-insecure-requests"
    );
  });

  it("relaxes only script-src for Vite under astro dev", () => {
    const dev = pagePolicy({
      ...deployed,
      origin: "http://localhost:4321",
      dev: true,
      deployed: false,
    });
    expect(directive(dev, "script-src")).toEqual(["'self'", "'unsafe-inline'"]);
    expect(directive(dev, "style-src")).toEqual(["'self'", "'unsafe-inline'"]);
    expect(directive(dev, "connect-src")).toEqual([
      "'self'",
      "ws://localhost:4321",
    ]);
    expect(directive(dev, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(dev, "object-src")).toEqual(["'none'"]);
  });
});

describe("hashesOf", () => {
  const astro =
    "script-src 'self' 'sha256-a+b/c=' 'sha384-d'; style-src 'self' 'sha512-e='; ";

  it("reads the hashes Astro rendered for a directive", () => {
    expect(hashesOf(astro, "script-src")).toEqual([
      "'sha256-a+b/c='",
      "'sha384-d'",
    ]);
  });

  it("takes nothing but hashes, and nothing without a policy", () => {
    expect(
      hashesOf(
        "script-src 'unsafe-inline' https://x 'sha256-ok='",
        "script-src"
      )
    ).toEqual(["'sha256-ok='"]);
    expect(hashesOf(null, "script-src")).toEqual([]);
    expect(hashesOf("img-src 'self'", "script-src")).toEqual([]);
  });
});

describe("CSP_MODE", () => {
  it("enforce sends the policy and its reporting endpoint", () => {
    expect(pagePolicyHeaders("default-src 'self'", "enforce", ORIGIN)).toEqual({
      "Content-Security-Policy": "default-src 'self'",
      "Reporting-Endpoints": `${CSP_REPORT_GROUP}="${ORIGIN}/api/csp-report"`,
    });
  });

  it("report-only reports the policy and still enforces what never breaks a page", () => {
    const headers = pagePolicyHeaders(
      pagePolicy(deployed),
      "report-only",
      ORIGIN
    );
    expect(headers["Content-Security-Policy"]).toBe(REPORT_ONLY_BASELINE_CSP);
    expect(headers["Content-Security-Policy-Report-Only"]).toContain(
      "script-src"
    );
    expect(headers["Content-Security-Policy-Report-Only"]).not.toContain(
      "upgrade-insecure-requests"
    );
  });
});

describe("headers of every response", () => {
  it("follow the OWASP Secure Headers recommendations", () => {
    expect(baseSecurityHeaders({ hsts: true })).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Frame-Options": "DENY",
      "X-Permitted-Cross-Domain-Policies": "none",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    });
    expect(baseSecurityHeaders({ hsts: false })).not.toHaveProperty(
      "Strict-Transport-Security"
    );
  });

  it("deny powerful features but keep passkeys on our origin", () => {
    const policy = baseSecurityHeaders({ hsts: false })["Permissions-Policy"];
    for (const feature of ["camera", "microphone", "geolocation", "payment"]) {
      expect(policy).toContain(`${feature}=()`);
    }
    expect(policy).toContain("publickey-credentials-get=(self)");
    expect(policy).toContain("publickey-credentials-create=(self)");
  });
});

describe("securityHeadersFor", () => {
  const settings: SecurityHeaderSettings = {
    cspMode: "enforce",
    deployed: true,
    dev: false,
    turnstile: true,
    webAnalytics: false,
    uploadOrigin: null,
  };
  const html = (headers: Record<string, string> = {}) =>
    new Response("<!doctype html>", {
      headers: { "content-type": "text/html", ...headers },
    });

  it("gives pages the page policy with Astro's hashes", () => {
    const headers = securityHeadersFor(
      new Request(`${ORIGIN}/sign-in`),
      html({
        "content-security-policy":
          "script-src 'self' 'sha256-island='; style-src 'self' 'sha256-css=';",
      }),
      settings
    );
    expect(headers["Content-Security-Policy"]).toContain(
      `script-src ${ORIGIN}/_astro/ 'sha256-island=' https://challenges.cloudflare.com`
    );
    expect(headers["Content-Security-Policy"]).toContain(
      "style-src 'self' 'unsafe-inline';"
    );
    expect(headers["Content-Security-Policy"]).not.toContain("sha256-css");
    expect(headers["Strict-Transport-Security"]).toBeDefined();
  });

  it("gives every non-page response the policy that loads nothing", () => {
    for (const [path, type] of [
      ["/api/hello", "application/json"],
      ["/mcp", "application/json"],
      ["/health/live", "application/health+json"],
      // A user's uploaded HTML is data, not a page of the app.
      ["/api/files/f1", "text/html"],
      ["/api/auth/error", "text/html"],
    ] as const) {
      const headers = securityHeadersFor(
        new Request(`${ORIGIN}${path}`),
        new Response("x", { headers: { "content-type": type } }),
        settings
      );
      expect(headers["Content-Security-Policy"], path).toBe(NON_HTML_CSP);
    }
  });

  it("keeps a stricter Referrer-Policy a route set", () => {
    const headers = securityHeadersFor(
      new Request(`${ORIGIN}/unsubscribe`),
      html({ "referrer-policy": "no-referrer" }),
      settings
    );
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
  });

  it("sends no HSTS locally or over plain HTTP", () => {
    expect(
      securityHeadersFor(new Request(`${ORIGIN}/`), html(), {
        ...settings,
        deployed: false,
      })["Strict-Transport-Security"]
    ).toBeUndefined();
    expect(
      securityHeadersFor(
        new Request("http://localhost:4321/"),
        html(),
        settings
      )["Strict-Transport-Security"]
    ).toBeUndefined();
  });

  it("enforces the page policy when the settings cannot be read", () => {
    const headers = securityHeadersFor(new Request(`${ORIGIN}/`), html(), {
      ...settings,
      cspMode: null,
      turnstile: false,
    });
    expect(headers["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(headers["Content-Security-Policy-Report-Only"]).toBeUndefined();
  });

  it("adds no-transform to every HTML response, whatever WEB_ANALYTICS says", () => {
    for (const webAnalytics of [false, true]) {
      const headers = securityHeadersFor(new Request(`${ORIGIN}/`), html(), {
        ...settings,
        webAnalytics,
      });
      // No public: a page rendered per request may be someone's own.
      expect(headers["Cache-Control"], `webAnalytics=${webAnalytics}`).toBe(
        "no-transform"
      );
    }
    // Also when the settings cannot be read.
    expect(
      securityHeadersFor(new Request(`${ORIGIN}/`), html(), {
        ...settings,
        cspMode: null,
      })["Cache-Control"]
    ).toBe("no-transform");
  });

  it("merges no-transform into the Cache-Control a page set, keeping no-store", () => {
    expect(
      securityHeadersFor(
        new Request(`${ORIGIN}/unsubscribe`),
        html({ "cache-control": "no-store" }),
        settings
      )["Cache-Control"]
    ).toBe("no-store, no-transform");
  });

  it("adds no-transform to HTML that is not a page (uploads, Better Auth's error page)", () => {
    for (const [path, cacheControl, expected] of [
      ["/api/files/f1", "private, no-store", "private, no-store, no-transform"],
      ["/api/auth/error", null, "no-transform"],
    ] as const) {
      const headers = securityHeadersFor(
        new Request(`${ORIGIN}${path}`),
        new Response("x", {
          headers: {
            "content-type": "text/html; charset=utf-8",
            ...(cacheControl ? { "cache-control": cacheControl } : {}),
          },
        }),
        settings
      );
      expect(headers["Cache-Control"], path).toBe(expected);
      expect(headers["Content-Security-Policy"], path).toBe(NON_HTML_CSP);
    }
  });

  it("leaves the Cache-Control of every other response alone", () => {
    for (const response of [
      new Response("{}", {
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      }),
      new Response("{}", { headers: { "content-type": "application/json" } }),
      // A redirect has no HTML body.
      new Response(null, { status: 302, headers: { location: "/sign-in" } }),
    ]) {
      expect(
        securityHeadersFor(new Request(`${ORIGIN}/app`), response, settings)[
          "Cache-Control"
        ]
      ).toBeUndefined();
    }
  });

  it("classifies pages by path and content type", () => {
    const page = html();
    expect(isAppPage("/", page)).toBe(true);
    expect(isAppPage("/app/dashboard", page)).toBe(true);
    expect(isAppPage("/api/trpc/x", page)).toBe(false);
    expect(isAppPage("/mcp", page)).toBe(false);
    expect(isAppPage("/.well-known/oauth-authorization-server", page)).toBe(
      false
    );
    expect(isAppPage("/", new Response("{}"))).toBe(false);
  });
});

describe("public/_headers", () => {
  it("is the rendering of this module (bun apps/web/scripts/write-static-headers.ts)", () => {
    const file = readFileSync(
      new URL("../../public/_headers", import.meta.url),
      "utf8"
    );
    expect(file).toBe(renderStaticHeaders());
  });

  it("gives the prerendered pages a page policy instead of the asset one", () => {
    const rules = renderStaticHeaders().split("\n\n");
    for (const path of PRERENDERED_PAGE_PATHS) {
      const rule = rules.find((candidate) => candidate.startsWith(`${path}\n`));
      expect(rule, path).toContain("! Content-Security-Policy");
      expect(rule, path).toContain(PRERENDERED_PAGE_CSP);
    }
    expect(PRERENDERED_PAGE_CSP).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(PRERENDERED_PAGE_CSP).toContain("frame-ancestors 'none'");
    // Pagefind's WebAssembly, never eval of JavaScript.
    expect(PRERENDERED_PAGE_CSP).toMatch(/script-src[^;]*'wasm-unsafe-eval'/);
    expect(PRERENDERED_PAGE_CSP).not.toMatch(/'unsafe-eval'/);
    expect(PRERENDERED_PAGE_CSP).toContain("object-src 'none'");
  });

  it("lets the docs search worker fetch its index and run its WebAssembly", () => {
    const rules = renderStaticHeaders().split("\n\n");
    const pagefind = rules.find((rule) => rule.startsWith("/pagefind/*\n"));
    expect(pagefind).toContain(`Content-Security-Policy: ${PAGEFIND_CSP}`);
    expect(PAGEFIND_CSP).toContain("connect-src 'self'");
    expect(PAGEFIND_CSP).not.toMatch(/'unsafe-(eval|inline)'/);
  });

  it("adds no-transform to every static HTML file, keeping its caching", () => {
    const rules = renderStaticHeaders().split("\n\n");
    const cacheOf = (path: string) =>
      rules
        .find((rule) => rule.startsWith(`${path}\n`))
        ?.split("\n")
        .find((line) => line.trim().startsWith("Cache-Control:"))
        ?.trim();
    for (const path of [...PRERENDERED_PAGE_PATHS, ...STATIC_HTML_PATHS]) {
      expect(cacheOf(path), path).toBe(
        "Cache-Control: public, max-age=0, must-revalidate, no-transform"
      );
    }
    // The Atom feed under /docs/* is not HTML: it gets its plain value back.
    const feed = rules.find((rule) => rule.startsWith("/docs/changelog.xml\n"));
    expect(feed).toContain("! Cache-Control");
    expect(cacheOf("/docs/changelog.xml")).toBe(
      "Cache-Control: public, max-age=0, must-revalidate"
    );
    // Assets keep Workers Static Assets' default: no rule for /* sets Cache-Control.
    expect(cacheOf("/*")).toBeUndefined();
  });

  it("has one block per path, so no rule replaces another's headers", () => {
    const paths = renderStaticHeaders()
      .split("\n\n")
      .slice(1)
      .map((rule) => rule.split("\n")[0]);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("gives Storybook its own policy instead of the asset one", () => {
    const rules = renderStaticHeaders().split("\n\n");
    const storybook = rules.find((rule) => rule.startsWith("/_storybook/*"));
    expect(storybook).toContain("! Content-Security-Policy");
    expect(storybook).toContain("frame-ancestors 'self'");
    expect(storybook).toContain("object-src 'none'");
    expect(storybook).toContain("X-Frame-Options: SAMEORIGIN");
  });
});
