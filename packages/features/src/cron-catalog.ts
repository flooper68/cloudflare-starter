// Composition root for scheduled work: every Cron Trigger entry. Each schedule must also be
// in `triggers.crons` of every environment in apps/web/wrangler.jsonc (once, however many
// entries share it), and each entry name must appear in a test
// (test/architecture/jobs.test.ts). Entries stay small: they enqueue jobs, and the queue
// does the work with its retries.

import { purgeAuditEventsJob } from "./audit";
import { expireTrialsJob } from "./billing";
import { createCronCatalog, enqueueJob, purgeIdempotencyKeysJob } from "./jobs";
import type { Clock, Ids } from "./kernel";
import type { JobQueue, Logger } from "./platform";

/** What a cron entry may use. */
export interface CronDeps {
  readonly jobQueue: JobQueue;
  readonly clock: Clock;
  readonly ids: Ids;
  readonly logger: Logger;
}

/** Daily at 03:17 UTC (off the hour, when fewer schedules fire); shared by the purges. */
const DAILY = "17 3 * * *";

export const cronCatalog = createCronCatalog<CronDeps>([
  {
    name: "audit.purge-events",
    schedule: DAILY,
    run: (deps, { scheduledTime, context }) =>
      enqueueJob(
        deps,
        purgeAuditEventsJob,
        { asOf: new Date(scheduledTime).toISOString() },
        { context }
      ),
  },
  {
    name: "jobs.purge-idempotency-keys",
    schedule: DAILY,
    run: (deps, { context }) =>
      enqueueJob(deps, purgeIdempotencyKeysJob, {}, { context }),
  },
  {
    name: "billing.expire-trials",
    schedule: DAILY,
    run: (deps, { scheduledTime, context }) =>
      enqueueJob(
        deps,
        expireTrialsJob,
        { asOf: new Date(scheduledTime).toISOString() },
        { context }
      ),
  },
]);
