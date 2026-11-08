import { defineConfig, devices } from "@playwright/test";

import { devPort } from "./dev-port.mjs";
import { DEMO_E2E_STATE } from "./test/e2e/demo-vite.mjs";

// E2E: the critical journeys in a real browser against `astro dev` with local bindings
// (D1, R2, queues and email simulated by Miniflare; nothing reaches a Cloudflare account).
// Needs apps/web/.dev.vars (copy .dev.vars.example) and a migrated local D1
// (`bun run db:migrate:local`). Run with `bun run test:e2e`. docs/architecture/testing.md.
// The port of this checkout's APP_URL (.dev.vars), the origin Better Auth trusts.
const port = devPort();
const baseURL = `http://localhost:${port}`;
// The demo-mode journeys (test/e2e/demo/) get their own dev server on the next port, with
// DEMO_MODE=on injected by test/e2e/demo-vite.mjs; every other journey runs with off.
const demoPort = port + 1;
const demoBaseURL = `http://localhost:${demoPort}`;
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
      testIgnore: /\/(smoke|demo)\//,
    },
    {
      name: "demo",
      testMatch: /\/demo\/.*\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], baseURL: demoBaseURL },
    },
  ],
  webServer: [
    {
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
    {
      // Its own local state (migrated first), APP_URL on demoPort, DEMO_MODE=on.
      env: { E2E_LOCAL_TURNSTILE: "1", E2E_DEMO_PORT: String(demoPort) },
      command: `bunx wrangler d1 migrations apply DB --local --persist-to ${DEMO_E2E_STATE} && bun run dev --ignore-lock --port ${demoPort}`,
      url: demoBaseURL,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
});

export default smokeBaseURL ? smoke : local;
