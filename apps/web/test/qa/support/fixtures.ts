/**
 * `qaTest`: the E2E `test` (with its Content-Security-Policy guard) for the automated QA
 * suite against a deployed app. Every context gets X-QA-Token on requests to the app's
 * origin only, never third parties, and the Turnstile stub (routing.ts). `runId` is the
 * run's id, shared by all workers (global-setup.ts).
 */
import { test } from "../../e2e/fixtures";
import { currentRunId } from "./address";
import { installQaRouting } from "./routing";

export { expect } from "../../e2e/fixtures";

export const qaTest = test.extend<{ runId: string }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixtures destructure their dependencies.
  runId: async ({}, use) => {
    await use(currentRunId());
  },
  context: async ({ context }, use) => {
    await installQaRouting(context);
    await use(context);
  },
});
