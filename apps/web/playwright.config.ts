import { defineConfig, devices } from "@playwright/test";

import { devPort } from "./dev-port.mjs";

// E2E: the critical journeys in a real browser against `astro dev` with local bindings
// (D1, R2, queues and email simulated by Miniflare; nothing reaches a Cloudflare account).
// Needs apps/web/.dev.vars (copy .dev.vars.example) and a migrated local D1
// (`bun run db:migrate:local`). Run with `bun run test:e2e`. docs/architecture/testing.md.
// The port of this checkout's APP_URL (.dev.vars), the origin Better Auth trusts.
const port = devPort();
const baseURL = `http://localhost:${port}`;
const ci = Boolean(process.env.CI);

// Production smoke: E2E_BASE_URL (set by `bun run test:smoke -- --base-url <url>`) points the
// run at a deployed app instead. Only the `production` project exists then, it runs only the
// `@smoke` specs in test/e2e/smoke/ (read-only GETs: no sign-up, no writes), and no local
// server starts. docs/architecture/testing.md#production-smoke.
const smokeBaseURL = process.env.E2E_BASE_URL;

const smoke = defineConfig({
  testDir: "./test/e2e/smoke",
  testMatch: /\.smoke\.ts$/,
  // Few, independent, read-only checks: parallel is fine and still gentle on the site.
  workers: 2,
  fullyParallel: true,
  forbidOnly: ci,
  // A deployed site can blip; one retry tells a blip from a regression.
  retries: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: smokeBaseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "production",
      grep: /@smoke/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

// Static pages: E2E_STATIC=1 (`bun run test:e2e:static`) builds the app (`astro build`,
// prerendering /docs and the Pagefind index) and serves the build with `astro preview` on
// the port after APP_URL's, then runs test/e2e/static/: the search dialog and axe on the
// public pages in both themes, as they are deployed. `astro dev` has no search index.
const staticPort = port + 1;
const staticPages = defineConfig({
  testDir: "./test/e2e/static",
  testMatch: /\.spec\.ts$/,
  workers: 2,
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${staticPort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "static", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // --ignore-lock keeps the preview server in the foreground, owned by Playwright.
    command: `bun run build:app && bunx astro preview --ignore-lock --port ${staticPort}`,
    url: `http://localhost:${staticPort}/docs/`,
    reuseExistingServer: !ci && process.env.E2E_REUSE_SERVER === "1",
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});

const local = defineConfig({
  testDir: "./test/e2e",
  // Sign-up is rate limited (5 per minute per IP, auth.sign-up in packages/features/src/abuse/domain/policies.ts) and the
  // journeys share one dev server: one worker, few sign-ups per run (see helpers.ts).
  workers: 1,
  fullyParallel: false,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // HTML report in apps/web/playwright-report (CI uploads it when a journey fails).
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    // APP_URL in .dev.vars; Better Auth only trusts that origin.
    baseURL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // Signs up the shared user once and saves its session for the journeys that only
    // need someone signed in.
    { name: "setup", testMatch: /\.setup\.ts$/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      // The production smoke specs run only against a deployed URL (`smoke` above).
      // The static-page specs run against a build (`staticPages` above).
      testIgnore: /\/(smoke|static)\//,
    },
  ],
  webServer: {
    // Local test keys, with no dependency on Cloudflare's live widget/Siteverify.
    env: { E2E_LOCAL_TURNSTILE: "1" },
    // --ignore-lock keeps astro dev in the foreground (Astro backgrounds it when an AI agent
    // runs it), so Playwright owns the process and stops it after the run.
    command: `bun run dev --ignore-lock --port ${port}`,
    url: baseURL,
    // Never a server this run did not start: on a shared machine the port may belong to
    // another checkout. A busy port fails the run; E2E_REUSE_SERVER=1 opts into reusing
    // your own running `bun run dev:web` (CI never sets it).
    reuseExistingServer: !ci && process.env.E2E_REUSE_SERVER === "1",
    // The first request compiles the app.
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});

export default smokeBaseURL
  ? smoke
  : process.env.E2E_STATIC === "1"
    ? staticPages
    : local;
