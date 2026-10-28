import { defineConfig, devices } from "@playwright/test";

// E2E: the critical journeys in a real browser against `astro dev` with local bindings
// (D1, R2, queues and email simulated by Miniflare; nothing reaches a Cloudflare account).
// Needs apps/web/.dev.vars (copy .dev.vars.example) and a migrated local D1
// (`bun run db:migrate:local`). Run with `bun run test:e2e`. docs/architecture/testing.md.
const baseURL = "http://localhost:4321";
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./test/e2e",
  // Sign-up is rate limited (5 per minute per IP, apps/web/src/server/auth.ts) and the
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
    command: "bun run dev --ignore-lock",
    url: baseURL,
    // Locally a running `bun run dev:web` is reused; CI always starts a fresh one.
    reuseExistingServer: !ci,
    // The first request compiles the app.
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
