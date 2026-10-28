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

export default defineConfig({
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
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: {
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
