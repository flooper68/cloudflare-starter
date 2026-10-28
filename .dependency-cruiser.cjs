/**
 * Architecture rules for packages/features, packages/ui and the server adapters in
 * apps/web/src/server (docs/architecture/overview.md#principles).
 * Run with `bun run deps:check` (part of `bun run lint` and CI). Import cycles are also
 * caught by Biome's noImportCycles; the rest is only enforced here.
 */
const FEATURES = "^packages/features/src";

/**
 * Packages packages/features may import outside platform/adapters/<vendor>/, each with its
 * reason. Anything else from npm is a vendor SDK and belongs in an adapter behind a port.
 * - zod: input and message schemas at every boundary
 * - drizzle-orm: the D1 query builder (features own their tables)
 * - aws4fetch: S3-API request signing for R2 presigned URLs (files/r2-presign.ts), a
 *   signing helper with no service of its own, not an SDK to wrap
 */
const FEATURES_ALLOWED_PACKAGES = ["zod", "drizzle-orm", "aws4fetch"];

/**
 * Third-party observability, analytics and billing SDKs: apps/web/src/server reaches them
 * only through a port, so they may only be imported by an adapter in packages/features.
 * Matches the package name whether or not it is installed.
 */
const VENDOR_SDKS = [
  "@sentry/",
  "posthog-",
  "dd-trace",
  "@datadog/",
  "@opentelemetry/",
  "newrelic",
  "@bugsnag/",
  "rollbar",
  "@logtail/",
  "@axiomhq/",
  "stripe",
  "@growthbook/",
  "launchdarkly-",
  "@launchdarkly/",
];
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const VENDOR_SDK_PATH = `(^|node_modules/)(${VENDOR_SDKS.map(escapeRegExp).join("|")})`;

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "No import cycles.",
      from: {},
      to: { circular: true },
    },
    {
      name: "kernel-is-pure",
      severity: "error",
      comment:
        "kernel/ holds pure building blocks: it imports nothing else in the package and no packages.",
      from: { path: `${FEATURES}/kernel/` },
      to: { pathNot: [`${FEATURES}/kernel/`] },
    },
    {
      name: "domain-is-pure",
      severity: "error",
      comment:
        "domain/ imports only its own feature's domain, the kernel, and zod. Time, ids and I/O are use-case dependencies.",
      from: { path: `${FEATURES}/([^/]+)/domain/` },
      to: {
        pathNot: [
          `${FEATURES}/$1/domain/`,
          `${FEATURES}/kernel/`,
          "node_modules/zod/",
        ],
      },
    },
    {
      name: "platform-does-not-know-features",
      severity: "error",
      comment:
        "platform/ is shared infrastructure; it must not depend on a feature or a composition root.",
      from: { path: `${FEATURES}/platform/` },
      to: { path: `${FEATURES}/`, pathNot: [`${FEATURES}/(platform|kernel)/`] },
    },
    {
      name: "features-only-through-barrels",
      severity: "error",
      comment:
        "Code in one folder (feature, platform, kernel) imports another folder only through its index.ts.",
      from: { path: `${FEATURES}/([^/]+)/` },
      to: {
        path: `${FEATURES}/[^/]+/`,
        pathNot: [`${FEATURES}/$1/`, `${FEATURES}/[^/]+/index\\.ts$`],
      },
    },
    {
      name: "features-not-ui",
      severity: "error",
      comment: "Server features and UI components never import each other.",
      from: { path: "^packages/features/" },
      to: { path: "^packages/ui/" },
    },
    {
      name: "ui-not-features",
      severity: "error",
      comment: "Server features and UI components never import each other.",
      from: { path: "^packages/ui/" },
      to: { path: "^packages/features/" },
    },
    {
      name: "vendor-sdks-only-in-adapters",
      severity: "error",
      comment:
        "Outside services only through a port: in packages/features, only platform/adapters/<vendor>/ imports a vendor SDK; elsewhere only the packages in FEATURES_ALLOWED_PACKAGES.",
      from: {
        path: `${FEATURES}/`,
        pathNot: `${FEATURES}/platform/adapters/(?!noop/|memory/)[^/]+/`,
      },
      to: {
        pathNot: [
          `${FEATURES}/`,
          `node_modules/(${FEATURES_ALLOWED_PACKAGES.join("|")})/`,
        ],
      },
    },
    {
      name: "vendor-sdks-not-in-app-server",
      severity: "error",
      comment:
        "apps/web/src/server reaches outside services through the ports in packages/features; vendor SDKs live in platform/adapters/<vendor>/.",
      from: { path: "^apps/web/src/server/" },
      to: { path: VENDOR_SDK_PATH },
    },
    {
      name: "packages-not-apps",
      severity: "error",
      comment: "Packages never import from apps.",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    // Tests, stories and port contract suites (test support, never bundled).
    exclude: { path: "(\\.test\\.ts|\\.stories\\.tsx|\\.contract\\.ts)$" },
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
