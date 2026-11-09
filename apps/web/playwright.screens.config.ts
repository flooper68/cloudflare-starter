import { defineConfig, devices } from "@playwright/test";

import { devPort } from "./dev-port.mjs";

// `bun run docs:screenshots`: the docs screenshots (test/screens/), against `astro dev`
// with local bindings and the demo seed (test/seed/demo.ts), like the E2E journeys. Not
// part of CI's checks: the docs-screenshots workflow runs it by hand and opens a PR.
// SHOTS=members,billing captures only those. docs/reference/docs-site.md#screenshots
const port = devPort();
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./test/screens",
  testMatch: /\.spec\.ts$/,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  outputDir: "test-results/screens-run",
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    env: { E2E_LOCAL_TURNSTILE: "1" },
    command: `bun run dev --ignore-lock --port ${port}`,
    url: baseURL,
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
