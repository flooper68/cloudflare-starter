/**
 * STUB: the QA infrastructure PR replaces this file. Contract: `cleanupRun(runId)` erases
 * every account of the run, that is every `qa-<runId>-*@<emailDomain>` address (the
 * journeys create no others; the persistent QA admin `qa-admin@…` is not run-scoped and
 * stays), through the app's erasure, never with SQL. It runs from the config's global
 * teardown, also when journeys failed.
 *
 * Until then: against a local dev server the accounts stay in the local D1, which is
 * disposable (every run uses new addresses, as the E2E suite does); against anything
 * else it fails the run, so a deployed environment is never left with silent leftovers.
 */
import { qaEnv } from "./env";

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/;

export async function cleanupRun(runId: string): Promise<void> {
  const { baseUrl } = qaEnv();
  if (LOCAL.test(new URL(baseUrl).hostname)) {
    console.log(
      `QA run ${runId}: local run, its accounts stay in the local D1 (STUB cleanupRun).`
    );
    return;
  }
  throw new Error(
    `QA run ${runId}: STUB cleanupRun cannot erase accounts on ${baseUrl}; the QA infrastructure PR implements it. Erase qa-${runId}-* by hand (docs/guides/how-to-qa-a-deployment.md#cleanup).`
  );
}
