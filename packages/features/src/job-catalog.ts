// Composition root for background jobs: every job type the queue consumer runs, paired with
// the use case that handles it. Features declare their jobs in their domain (defineJob) and
// enqueue them with enqueueJob; registering one here is what makes the consumer run it.
import { purgeAuditEvents, purgeAuditEventsJob } from "./audit";
import { expireTrials, expireTrialsJob } from "./billing";
import { helloJob, sayHello } from "./greetings";
import {
  createJobCatalog,
  type JobDeps,
  purgeIdempotencyKeys,
  purgeIdempotencyKeysJob,
  registerJob,
} from "./jobs";

export const jobCatalog = createJobCatalog<JobDeps>([
  registerJob(helloJob, sayHello),
  // The cutoff comes from the cron run's time, so every retry purges the same events.
  registerJob(purgeAuditEventsJob, (deps: JobDeps, payload) =>
    purgeAuditEvents({
      db: deps.db,
      clock: { now: () => new Date(payload.asOf) },
    })
  ),
  registerJob(purgeIdempotencyKeysJob, (deps: JobDeps) =>
    purgeIdempotencyKeys(deps)
  ),
  // Judged as of the cron run's time; audited with the delivery's trace.
  registerJob(expireTrialsJob, (deps: JobDeps, payload, job) =>
    expireTrials({
      db: deps.db,
      clock: { now: () => new Date(payload.asOf) },
      ids: deps.ids,
      requestContext: job.context,
    })
  ),
]);
