import { cleanupRun } from "./support/accounts";
import { qaSkipReason } from "./support/env";

/**
 * After the run, whatever happened: erase every account it created that a journey did not
 * erase itself (support/accounts.ts cleanupRun). Leftovers of a run that was killed are
 * the nightly cleanup's (cleanup/leftovers.cleanup.ts).
 */
export default async function globalTeardown(): Promise<void> {
  const runId = process.env.QA_RUN_ID;
  if (!runId || qaSkipReason()) return;
  const { erased, gone, leftForNightly } = await cleanupRun(runId);
  console.log(
    `QA run ${runId} cleanup: ${erased.length} erased, ${gone.length} already gone, ${leftForNightly.length} left for the nightly cleanup`
  );
}
