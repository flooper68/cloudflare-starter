import { defineConfig, devices } from "@playwright/test";

// The automated QA suite: real journeys with real accounts against a DEPLOYED app (by
// default production, https://starter.flooper.me), with no human. Mail to QA addresses
// is kept in the app's QA outbox instead of sent (GET /api/qa/outbox), and the QA bypass
// replaces Turnstile for QA addresses only. Run with `bun run test:qa -- --base-url <url>`
// and QA_TOKEN set; without it every journey skips and says why.
// docs/guides/how-to-qa-a-deployment.md
const baseURL = process.env.QA_BASE_URL;
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./test/qa",
  // Its own folders, so a local E2E run and a QA run never overwrite each other's results.
  outputDir: "test-results/qa",
  // The run id (QA_RUN_ID) all workers share; afterwards every account the run created is
  // erased (support/accounts.ts cleanupRun), whatever happened.
  globalSetup: "./test/qa/global-setup.ts",
  globalTeardown: "./test/qa/global-teardown.ts",
  // Production is shared and rate limited per IP (5 sign-ups and 3 erasures a minute or
  // hour, auth.* in the abuse catalog): one journey at a time, never a blind retry that
  // would sign up more accounts.
  workers: 1,
  fullyParallel: false,
  forbidOnly: ci,
  retries: 0,
  // Journeys wait for real mail (up to two minutes each).
  timeout: 5 * 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/qa" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "qa",
      testMatch: /\.qa\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Nightly, not part of `test:qa`: erases accounts aborted runs left behind, as the
      // QA admin (cleanup/leftovers.cleanup.ts).
      name: "qa-cleanup",
      testMatch: /cleanup\/.*\.cleanup\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Weekly, not part of `test:qa`: one real mail through the real sender
      // (delivery/real-delivery.delivery.ts), since the outbox keeps the suite's own mail.
      name: "qa-delivery",
      testMatch: /delivery\/.*\.delivery\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
