import { newRunId, RUN_ID_PATTERN } from "./support/address";
import { ensureQaAdmin } from "./support/admin";
import { qaSkipReason } from "./support/env";

/**
 * Once per `playwright test -c playwright.qa.config.ts`, before the workers start (they
 * inherit the environment): the run's id, unless QA_RUN_ID is set already, and the QA
 * admin, created and verified through the QA bypass and the QA outbox when it does not
 * exist yet. Nothing here needs the owner: QA_TOKEN is the only secret.
 */
export default async function globalSetup(): Promise<void> {
  if (!process.env.QA_RUN_ID || !RUN_ID_PATTERN.test(process.env.QA_RUN_ID)) {
    process.env.QA_RUN_ID = newRunId();
  }
  const skipped = qaSkipReason();
  console.log(
    skipped
      ? `QA run ${process.env.QA_RUN_ID}: ${skipped}`
      : `QA run ${process.env.QA_RUN_ID} against ${process.env.QA_BASE_URL}`
  );
  if (!skipped) await ensureQaAdmin();
}
