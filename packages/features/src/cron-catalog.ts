// Composition root for scheduled work: every Cron Trigger entry. Each schedule must also be
// in `triggers.crons` of every environment in apps/web/wrangler.jsonc (once, however many
// entries share it), and each entry name must appear in a test
// (test/architecture/jobs.test.ts). Entries stay small: they enqueue jobs, and the queue
// does the work with its retries.

import { purgeAuditEventsJob } from "./audit";
import { expireTrialsJob } from "./billing";
import { retryFileCleanupsJob } from "./files";
import { createCronCatalog, enqueueJob, purgeIdempotencyKeysJob } from "./jobs";
import type { Clock, Ids } from "./kernel";
import {
  DIGEST_SCHEDULE,
  planDigestsJob,
  purgeNotificationsJob,
} from "./notifications";
import type { JobQueue, Logger } from "./platform";
import { purgeDataExportsJob } from "./privacy";
import {
  reconcileStorageJob,
  type StorageReconcileMode,
} from "./storage-reconciliation";
import { purgeExpiredTrashJob } from "./trash";

/** What a cron entry may use. */
export interface CronDeps {
  readonly storageReconcile: StorageReconcileMode;
  readonly jobQueue: JobQueue;
  readonly clock: Clock;
  readonly ids: Ids;
  readonly logger: Logger;
}

/** Daily at 03:17 UTC (off the hour, when fewer schedules fire); shared by the purges. */
const DAILY = "17 3 * * *";

export const cronCatalog = createCronCatalog<CronDeps>([
  {
    name: "files.retry-cleanup",
    schedule: "17 * * * *",
    run: (deps, { context }) =>
      enqueueJob(deps, retryFileCleanupsJob, {}, { context }),
  },
  {
    name: "privacy.purge-exports",
    schedule: "17 * * * *",
    run: (deps, { scheduledTime, context }) =>
      enqueueJob(
        deps,
        purgeDataExportsJob,
        { asOf: new Date(scheduledTime).toISOString() },
        { context }
      ),
  },
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
  {
    name: "notifications.purge",
    schedule: DAILY,
    run: (deps, { scheduledTime, context }) =>
      enqueueJob(
        deps,
        purgeNotificationsJob,
        { asOf: new Date(scheduledTime).toISOString() },
        { context }
      ),
  },
  {
    // Daily at DIGEST_HOUR_UTC: users on the daily email cadence get their summary.
    name: "notifications.plan-digests",
    schedule: DIGEST_SCHEDULE,
    run: (deps, { scheduledTime, context }) =>
      enqueueJob(
        deps,
        planDigestsJob,
        { asOf: new Date(scheduledTime).toISOString() },
        { context }
      ),
  },
  {
    name: "trash.purge-expired",
    schedule: DAILY,
    run: (deps, { scheduledTime, context }) =>
      enqueueJob(
        deps,
        purgeExpiredTrashJob,
        { asOf: new Date(scheduledTime).toISOString() },
        { context }
      ),
  },
  {
    name: "storage.reconcile",
    schedule: DAILY,
    run: async (deps, { scheduledTime, context }) => {
      if (deps.storageReconcile === "off") return;
      return enqueueJob(
        deps,
        reconcileStorageJob,
        {
          runId: deps.ids.uuid(),
          mode: deps.storageReconcile,
          trigger: "scheduled",
          asOf: new Date(scheduledTime).toISOString(),
          prefix: "workspaces/",
        },
        { context }
      );
    },
  },
]);
