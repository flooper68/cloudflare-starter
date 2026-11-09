/**
 * Nightly: erases QA run accounts that aborted runs left on the deployed app (CI workflow
 * `QA`, job `cleanup`), through the app's QA cleanup endpoint with the QA token: every
 * `qa+<runId>-<role>@<QA_EMAIL_DOMAIN>` account older than two hours, through the real
 * erasure, never the QA admin and never any other address. No admin, no browser, never
 * SQL. apps/web/test/qa/README.md#nightly-cleanup
 */
import { expect, qaEnv, qaSkipReason, qaTest } from "../support";
import { qaCleanup } from "../support/accounts";

qaTest.skip(qaSkipReason() !== null, qaSkipReason() ?? "");

qaTest("erase QA accounts left by aborted runs", async () => {
  const env = qaEnv();
  const erased: string[] = [];
  let remaining: readonly string[] = [];
  // At most a batch per call: call until nothing more goes.
  for (let call = 0; call < 10; call++) {
    const result = await qaCleanup(env, {});
    erased.push(...result.erased);
    remaining = result.remaining;
    if (result.erased.length === 0) break;
  }
  console.log(
    `QA nightly cleanup: ${erased.length} leftover account(s) erased${remaining.length ? `, ${remaining.length} could not go (a workspace another account uses): ${remaining.join(", ")}` : ""}`
  );
  expect(remaining, "leftovers that cannot be erased").toEqual([]);
});
