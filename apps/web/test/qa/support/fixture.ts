/**
 * STUB: the QA infrastructure PR replaces this file. Contract: `qaTest` is the E2E `test`
 * (with its CSP guard) plus X-QA-Token on app-origin requests only, and a worker-scoped
 * `runId`. The run id comes from the config's global setup (QA_RUN_ID).
 */
import type { BrowserContext } from "@playwright/test";

import { test as base, expect } from "../../e2e/fixtures";
import { qaEnv } from "./env";

export { expect };

/** The run's id, set once per run by the config's global setup. */
export function currentRunId(): string {
  const runId = process.env.QA_RUN_ID;
  if (!runId)
    throw new Error("QA_RUN_ID is not set (global setup did not run)");
  return runId;
}

/** Adds X-QA-Token to every request to the app's origin, and to nothing else. */
export async function addQaToken(context: BrowserContext): Promise<void> {
  const { baseUrl, qaToken } = qaEnv();
  await context.route(
    (url) => url.origin === baseUrl,
    (route) =>
      route.fallback({
        headers: { ...route.request().headers(), "x-qa-token": qaToken },
      })
  );
}

export const qaTest = base.extend<object, { runId: string }>({
  runId: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright fixtures take a destructuring parameter
    async ({}, use) => {
      await use(currentRunId());
    },
    { scope: "worker" },
  ],
  context: async ({ context }, use) => {
    await addQaToken(context);
    await use(context);
  },
});
