/**
 * Architecture rules for packages/features and packages/ui (docs/architecture/overview.md#principles).
 * Run with `bun run deps:check` (part of `bun run lint` and CI). Import cycles are also
 * caught by Biome's noImportCycles; the rest is only enforced here.
 */
const FEATURES = "^packages/features/src";

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
      name: "packages-not-apps",
      severity: "error",
      comment: "Packages never import from apps.",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(\\.test\\.ts|\\.stories\\.tsx)$" },
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
