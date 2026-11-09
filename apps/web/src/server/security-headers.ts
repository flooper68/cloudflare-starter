/**
 * Security response headers, after the OWASP Secure Headers Project, for every response
 * the Worker serves (pages, API, /mcp, auth, health) and, through `public/_headers`, for
 * the static assets. Pure: no bindings, so the policy can be unit tested and rendered into
 * `public/_headers` by `scripts/write-static-headers.ts`.
 *
 * HTML pages get a Content-Security-Policy Level 3 built per request from the settings
 * (TURNSTILE, WEB_ANALYTICS, presigned uploads, CSP_MODE) plus the hashes of the inline
 * scripts Astro rendered into the page (`security.csp` in astro.config.mjs).
 * Every other response gets a policy that loads nothing. Guide:
 * docs/guides/how-to-configure-security-headers.md.
 */

import { withNoTransform } from "./cache-control";
import { STATIC_CACHE_RULES } from "./static-cache";

/**
 * The theme script (public/site-theme.js): a blocking script in <head> that applies the
 * saved theme before the first paint, on the public pages and on the account pages. The
 * page policy allows exactly this file by its full URL, which matches no other path (a
 * source without a trailing slash is an exact match); it is a build-owned static asset,
 * never an upload (those are served under /api/files).
 */
export const THEME_SCRIPT_PATH = "/site-theme.js";

/** Where browsers send violation reports (src/pages/api/csp-report.ts). */
export const CSP_REPORT_PATH = "/api/csp-report";
/** The Reporting API endpoint name of `report-to` and `Reporting-Endpoints`. */
export const CSP_REPORT_GROUP = "csp-endpoint";

/** Cloudflare Turnstile: its script and its challenge iframe. */
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
/** Cloudflare Web Analytics: the beacon script and where it sends page views. */
export const WEB_ANALYTICS_SCRIPT_ORIGIN =
  "https://static.cloudflareinsights.com";
export const WEB_ANALYTICS_REPORT_ORIGIN = "https://cloudflareinsights.com";

/** One year, as OWASP recommends. No `preload`: see the guide before adding it. */
export const HSTS_VALUE = "max-age=31536000; includeSubDomains";

/**
 * Powerful features nobody on the page may use; passkeys (WebAuthn) only on our own
 * origin. Features not listed keep the browser default.
 */
export const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "autoplay=()",
  "camera=()",
  "display-capture=()",
  "encrypted-media=()",
  "geolocation=()",
  "gyroscope=()",
  "hid=()",
  "idle-detection=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "picture-in-picture=()",
  "publickey-credentials-create=(self)",
  "publickey-credentials-get=(self)",
  "screen-wake-lock=()",
  "serial=()",
  "usb=()",
  "xr-spatial-tracking=()",
].join(", ");

/**
 * The policy of every response that is not an HTML page (JSON, Problem Details, files,
 * health, MCP, assets): it may load nothing, run nothing and be framed by nobody. A user's
 * uploaded HTML or SVG opened from /api/files therefore cannot run script.
 */
export const NON_HTML_CSP =
  "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

/**
 * What a report-only page still enforces: directives that never break a page. Clickjacking
 * and plugin protection stay on while the full policy is only reported.
 */
export const REPORT_ONLY_BASELINE_CSP =
  "frame-ancestors 'none'; object-src 'none'; base-uri 'self'";

/**
 * Storybook at /_storybook/ (static files built by `storybook build`). Looser than the
 * app's pages by necessity: its manager and preview pages carry inline scripts and styles
 * that change with every build and that Storybook gives no hash or nonce for, so script-src
 * and style-src allow 'unsafe-inline'. It loads nothing from other origins, may only be
 * framed by itself (the manager frames the preview iframe), and holds no user data; a
 * project that needs it private protects the path with Cloudflare Access
 * (docs/guides/how-to-use-storybook.md#access).
 */
export const STORYBOOK_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

/** Headers of every response, HTML or not. HSTS only where `hsts` (deployed, HTTPS). */
export function baseSecurityHeaders(options: {
  readonly hsts: boolean;
}): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": PERMISSIONS_POLICY,
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    // Legacy fallback of frame-ancestors for browsers without CSP Level 2.
    "X-Frame-Options": "DENY",
    "X-Permitted-Cross-Domain-Policies": "none",
    ...(options.hsts ? { "Strict-Transport-Security": HSTS_VALUE } : {}),
  };
}

export interface PagePolicyInput {
  /** The page's origin (`https://starter.flooper.me`): scripts only from its /_astro/. */
  readonly origin: string;
  /**
   * `astro dev`: Vite serves modules from /src and /node_modules and injects inline
   * scripts, so script-src is relaxed to 'self' 'unsafe-inline' (every other directive
   * stays as deployed). Never true in a build.
   */
  readonly dev: boolean;
  /** Deployed over HTTPS: adds upgrade-insecure-requests. */
  readonly deployed: boolean;
  /** TURNSTILE=on: the widget's script and iframe. */
  readonly turnstile: boolean;
  /** WEB_ANALYTICS=cloudflare: the beacon's script and where it reports. */
  readonly webAnalytics: boolean;
  /**
   * The R2 S3 endpoint presigned uploads PUT to (`https://<account>.r2.cloudflarestorage.com/<bucket>/`),
   * null when presigned URLs are not configured.
   */
  readonly uploadOrigin: string | null;
  /** Hashes Astro computed for the page's inline scripts (`'sha256-…'`, quoted). */
  readonly scriptHashes: readonly string[];
}

/**
 * Styles may be inline: Radix's modal primitives (Dialog, Sheet, menus, Select) append a
 * `<style>` computed from the measured scrollbar width at runtime, which no build-time
 * hash can match, and sonner injects its stylesheet. Hashes would switch 'unsafe-inline'
 * off, so there are none. Injected CSS cannot run script; script-src stays strict.
 */
export const PAGE_STYLE_SRC = "'self' 'unsafe-inline'";

/**
 * The public pages Astro prerenders (`prerender = true`: the docs site and the 404),
 * served as static assets without running the Worker, so their policy is a fixed
 * `_headers` rule instead of the per-request page policy. Astro also writes its own
 * `<meta http-equiv="content-security-policy">` into each prerendered page (script
 * hashes; style-src from `security.csp.styleDirective`); the browser enforces both.
 * The pages run no inline script (`bun run budget` and the architecture tests refuse
 * it), only files from this origin: no path can be pinned without knowing the origin,
 * so script-src is 'self' (the pages hold no user content that could point a script
 * at /api/files). Styles may be inline: Shiki colours code with `style` attributes.
 * The Web Analytics origins are always allowed here, because the rule is the same in
 * every environment while WEB_ANALYTICS differs.
 */
// /: the landing page. /404: the Worker answers an unknown path with this prerendered
// asset and its headers.
export const PRERENDERED_PAGE_PATHS = [
  "/",
  "/docs/*",
  "/404",
  "/404.html",
] as const;

/**
 * The static files that are not HTML pages, outside the paths that have their own
 * policy (/pagefind/*, /_storybook/*): they get NON_HTML_CSP. Listed, not `/*`: a `/*`
 * policy also matches every HTML file, and taking it off there with
 * `! Content-Security-Policy` only works when `/*` is applied first. Cloudflare's asset
 * layer does not keep the file's order (production applied `/` before `/*` and served
 * the landing page with both policies, which browsers both enforce). A file public/ or
 * the build adds must be covered here; security-headers.test.ts and the build journeys
 * fail otherwise.
 */
export const STATIC_ASSET_PATHS = [
  // Bundles (their immutable Cache-Control is in static-cache.ts).
  "/_astro/*",
  // public/
  "/favicon.svg",
  THEME_SCRIPT_PATH,
  // Prerendered non-HTML routes and the sitemap integration's files.
  "/robots.txt",
  "/sitemap-*",
] as const;

/**
 * `/pagefind/*` (the docs search index and its client, written by the build): Pagefind
 * searches in a Web Worker started from `/pagefind/`, and a worker runs under the policy
 * of its own script's response, not the page's. It may fetch the index from this origin
 * and compile Pagefind's WebAssembly, nothing else.
 */
export const PAGEFIND_CSP = [
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

export const PRERENDERED_PAGE_CSP = [
  "default-src 'self'",
  // Pagefind (the docs search) runs WebAssembly.
  `script-src 'self' 'wasm-unsafe-eval' ${WEB_ANALYTICS_SCRIPT_ORIGIN}`,
  "script-src-attr 'none'",
  `style-src ${PAGE_STYLE_SRC}`,
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self' ${WEB_ANALYTICS_REPORT_ORIGIN}`,
  "frame-src 'none'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
  `report-uri ${CSP_REPORT_PATH}`,
].join("; ");

/**
 * The Content-Security-Policy of an HTML page: default-src 'self', scripts only from our
 * bundles and the hashed inline scripts (no 'unsafe-inline', no 'unsafe-eval'), third
 * parties only when their setting is on, no plugins, no framing, reports to
 * /api/csp-report.
 */
export function pagePolicy(input: PagePolicyInput): string {
  const script = input.dev
    ? ["'self'", "'unsafe-inline'"]
    : [
        // Our bundles, not all of 'self': /api/files serves user uploads from this origin.
        `${input.origin}/_astro/`,
        // The theme script, this one file only.
        `${input.origin}${THEME_SCRIPT_PATH}`,
        ...input.scriptHashes,
      ];
  if (input.turnstile) script.push(TURNSTILE_ORIGIN);
  if (input.webAnalytics) script.push(WEB_ANALYTICS_SCRIPT_ORIGIN);

  const connect = ["'self'"];
  if (input.uploadOrigin) connect.push(input.uploadOrigin);
  if (input.webAnalytics) connect.push(WEB_ANALYTICS_REPORT_ORIGIN);
  // Vite's hot-reload socket.
  if (input.dev) connect.push(input.origin.replace(/^http/, "ws"));

  const directives = [
    "default-src 'self'",
    `script-src ${script.join(" ")}`,
    // No inline event handlers (onclick=…) anywhere.
    "script-src-attr 'none'",
    `style-src ${PAGE_STYLE_SRC}`,
    // The TOTP QR code is a data: SVG; avatars and logos come from our own routes.
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${connect.join(" ")}`,
    `frame-src ${input.turnstile ? TURNSTILE_ORIGIN : "'none'"}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    // Every form posts to us; OAuth and Google sign-in leave by navigation, not by form.
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(input.deployed ? ["upgrade-insecure-requests"] : []),
    `report-uri ${input.origin}${CSP_REPORT_PATH}`,
    `report-to ${CSP_REPORT_GROUP}`,
  ];
  return directives.join("; ");
}

/**
 * The `'sha256-…'` sources of one directive in a policy Astro rendered (`script-src
 * 'self' 'sha256-a' 'sha256-b';`). Empty when the directive or the policy is missing.
 */
export function hashesOf(
  policy: string | null,
  directive: "script-src"
): string[] {
  if (!policy) return [];
  for (const part of policy.split(";")) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name === directive) {
      return sources.filter((source) =>
        /^'sha(256|384|512)-[A-Za-z0-9+/=]+'$/.test(source)
      );
    }
  }
  return [];
}

/** Response headers carrying the page policy, by CSP_MODE. */
export function pagePolicyHeaders(
  policy: string,
  mode: "enforce" | "report-only",
  origin: string
): Record<string, string> {
  const reporting = {
    "Reporting-Endpoints": `${CSP_REPORT_GROUP}="${origin}${CSP_REPORT_PATH}"`,
  };
  if (mode === "enforce") {
    return { "Content-Security-Policy": policy, ...reporting };
  }
  return {
    // upgrade-insecure-requests is ignored (with a console warning) in report-only.
    "Content-Security-Policy-Report-Only": policy
      .split("; ")
      .filter((directive) => directive !== "upgrade-insecure-requests")
      .join("; "),
    "Content-Security-Policy": REPORT_ONLY_BASELINE_CSP,
    ...reporting,
  };
}

/** Paths that answer data, never an app page, whatever their content type. */
const NON_PAGE_PREFIXES = ["/api/", "/mcp", "/.well-known/", "/health"];

/** Whether a response is HTML, wherever it is served (gets `no-transform`). */
export function isHtml(response: Response): boolean {
  const type = response.headers.get("content-type") ?? "";
  return type.toLowerCase().startsWith("text/html");
}

/** Whether a response is an HTML page of the app (gets the page policy). */
export function isAppPage(pathname: string, response: Response): boolean {
  if (NON_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }
  return isHtml(response);
}

export interface SecurityHeaderSettings {
  /** CSP_MODE; null when the settings cannot be read (the strictest choice applies). */
  readonly cspMode: "enforce" | "report-only" | null;
  readonly deployed: boolean;
  readonly dev: boolean;
  readonly turnstile: boolean;
  readonly webAnalytics: boolean;
  readonly uploadOrigin: string | null;
}

/**
 * Adds the security headers to a response the Worker serves. Headers a route set itself
 * (a stricter Referrer-Policy, a Cache-Control) are kept; Astro's own
 * Content-Security-Policy on a page is replaced by the full page policy, keeping its hashes.
 * Every HTML response, page or not and whatever WEB_ANALYTICS says, gets `no-transform`
 * merged into its Cache-Control, so the Cloudflare edge injects no Web Analytics beacon
 * (or any other script) the policy would block (cache-control.ts).
 */
export function securityHeadersFor(
  request: Request,
  response: Response,
  settings: SecurityHeaderSettings
): Record<string, string> {
  const url = new URL(request.url);
  const https = url.protocol === "https:";
  const headers: Record<string, string> = baseSecurityHeaders({
    hsts: settings.deployed && https,
  });
  const existingReferrer = response.headers.get("referrer-policy");
  if (existingReferrer) headers["Referrer-Policy"] = existingReferrer;
  if (isHtml(response)) {
    headers["Cache-Control"] = withNoTransform(
      response.headers.get("cache-control")
    );
  }

  if (!isAppPage(url.pathname, response)) {
    headers["Content-Security-Policy"] =
      response.headers.get("content-security-policy") ?? NON_HTML_CSP;
    return headers;
  }

  const astroPolicy = response.headers.get("content-security-policy");
  const policy = pagePolicy({
    origin: url.origin,
    dev: settings.dev,
    deployed: settings.deployed && https,
    turnstile: settings.turnstile,
    webAnalytics: settings.webAnalytics,
    uploadOrigin: settings.uploadOrigin,
    scriptHashes: hashesOf(astroPolicy, "script-src"),
  });
  return {
    ...headers,
    ...pagePolicyHeaders(policy, settings.cspMode ?? "enforce", url.origin),
  };
}

/** The R2 endpoint a presigned upload PUTs to (files/r2-presign.ts), for connect-src. */
export function presignedUploadOrigin(r2: {
  readonly accountId: string;
  readonly filesBucketName: string;
}): string {
  return `https://${r2.accountId}.r2.cloudflarestorage.com/${r2.filesBucketName}/`;
}

/**
 * `public/_headers`: the same headers for static assets, which Workers Static Assets serves
 * without running the Worker. Cloudflare applies every rule whose path matches; a
 * header a second rule sets again is appended, not replaced, and the order the rules
 * are applied in is not the file's (production applied `/` before `/*`). So `/*`
 * carries only the headers that are the same everywhere, and each path group sets its
 * own Content-Security-Policy and X-Frame-Options in rules that never overlap: no
 * response can get two policies, whatever the order, and none relies on `! Name`.
 * Deployed builds are served over HTTPS only, and browsers ignore HSTS over plain HTTP,
 * so the static rules always carry it.
 */
export function renderStaticHeaders(): string {
  const { "X-Frame-Options": _sameEverywhereExceptStorybook, ...common } =
    baseSecurityHeaders({ hsts: true });
  const base = Object.entries(common).map(
    ([name, value]) => `${name}: ${value}`
  );
  const policy = (csp: string, frameOptions = "DENY") => [
    `Content-Security-Policy: ${csp}`,
    `X-Frame-Options: ${frameOptions}`,
  ];
  // One block per path: a second block for the same path replaces the first in
  // Workers Static Assets, so a path's cache lines join its security block.
  const blocks = new Map<string, string[]>([
    ["/*", base],
    ...STATIC_ASSET_PATHS.map((path): [string, string[]] => [
      path,
      policy(NON_HTML_CSP),
    ]),
    ...PRERENDERED_PAGE_PATHS.map((path): [string, string[]] => [
      path,
      policy(PRERENDERED_PAGE_CSP),
    ]),
    ["/pagefind/*", policy(PAGEFIND_CSP)],
    ["/_storybook/*", policy(STORYBOOK_CSP, "SAMEORIGIN")],
  ]);
  for (const rule of STATIC_CACHE_RULES) {
    const lines = [
      ...(rule.replaces ? ["! Cache-Control"] : []),
      `Cache-Control: ${rule.cacheControl}`,
    ];
    blocks.set(rule.path, [...(blocks.get(rule.path) ?? []), ...lines]);
  }
  return `${[
    [
      "# Generated by apps/web/scripts/write-static-headers.ts from src/server/security-headers.ts",
      "# and src/server/static-cache.ts. Do not edit: change the modules and run",
      "# `bun apps/web/scripts/write-static-headers.ts`.",
      "# docs/reference/security-headers.md#static-assets",
    ].join("\n"),
    ...[...blocks].map(([path, lines]) =>
      [path, ...lines.map((line) => `  ${line}`)].join("\n")
    ),
  ].join("\n\n")}\n`;
}
