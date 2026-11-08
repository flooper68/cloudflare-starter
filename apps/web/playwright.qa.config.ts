import { defineConfig, devices } from "@playwright/test";

// Scripted feature QA (docs/guides/how-to-qa-a-deployment.md) as Playwright journeys
// against a deployed environment, unattended: `bun run test:qa -- --base-url <url>`.
// The run creates its own accounts (`qa-<runId>-<role>@<QA_EMAIL_DOMAIN>`) and the
// global teardown erases them, also after failures. Without the QA variables every
// journey skips with the reason. Map, budget and skips: test/qa/README.md.
//
// STUB of the QA infrastructure PR's config (same project name, test dir and script).
const ci = Boolean(process.env.CI);

// Never write what a person typed into an artifact: no traces (they record every fill,
// passwords included) and no page snapshot in error-context.md (it holds input values).
// Failures keep a screenshot, where password fields show as dots.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";

export default defineConfig({
  testDir: "./test/qa",
  testMatch: /\.qa\.ts$/,
  outputDir: "./test-results/qa",
  globalSetup: "./test/qa/support/global-setup.ts",
  globalTeardown: "./test/qa/support/global-teardown.ts",
  // Files run in parallel, the steps of one file in order on its own accounts. Rate
  // limits are per IP across the whole run; support/limits.ts paces every worker.
  workers: 4,
  fullyParallel: false,
  forbidOnly: ci,
  // A journey that failed half-way has used its accounts; a retry would sign up anew.
  retries: 0,
  // Hooks that create accounts may wait for sign-up slots (support/limits.ts).
  timeout: 300_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/qa" }],
  ],
  use: {
    baseURL: process.env.QA_BASE_URL,
    trace: "off",
    screenshot: "only-on-failure",
    colorScheme: "dark",
  },
  projects: [{ name: "qa", use: { ...devices["Desktop Chrome"] } }],
});
