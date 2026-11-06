import { defineConfig, devices } from "@playwright/test";

import { devPort } from "./dev-port.mjs";

// The built app's security headers and Content-Security-Policy in a real browser. `astro
// dev` applies neither Astro's script and style hashes nor public/_headers, so these
// journeys run against `astro preview` of the build (workerd with local bindings, as
// deployed): public pages with the Turnstile widget, Storybook, assets and API answers,
// with zero CSP violations. Run with `bun run test:e2e:build` after `bun run build`.
// docs/guides/how-to-configure-security-headers.md#tests
// APP_URL's port, like the dev journeys: Better Auth trusts only that origin, so the two
// configs cannot run at the same time in one checkout.
const port = devPort();
const baseURL = `http://localhost:${port}`;
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./test/e2e-build",
  workers: 1,
  fullyParallel: false,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: "test-results/build",
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/build" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // --ignore-lock keeps it in the foreground, so Playwright owns and stops it.
    command: `bunx astro preview --ignore-lock --port ${port}`,
    url: `${baseURL}/health/live`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
