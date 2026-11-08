import { newRunId, RUN_ID_PATTERN } from "./support/address";
import { qaSkipReason } from "./support/env";

/**
 * Once per `playwright test -c playwright.qa.config.ts`, before the workers start (they
 * inherit the environment): the run's id, unless QA_RUN_ID is set already.
 */
export default function globalSetup(): void {
  if (!process.env.QA_RUN_ID || !RUN_ID_PATTERN.test(process.env.QA_RUN_ID)) {
    process.env.QA_RUN_ID = newRunId();
  }
  const skipped = qaSkipReason();
  console.log(
    skipped
      ? `QA run ${process.env.QA_RUN_ID}: ${skipped}`
      : `QA run ${process.env.QA_RUN_ID} against ${process.env.QA_BASE_URL}`
  );
}
