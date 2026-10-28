import { z } from "zod";

import { defineJob } from "../../kernel";

/**
 * Deletes audit events past retention; enqueued daily by the cron entry of the same name.
 * `asOf` is the cron run's scheduled time, so every retry purges against the same cutoff.
 */
export const purgeAuditEventsJob = defineJob({
  type: "audit.purge-events",
  payload: z.object({ asOf: z.iso.datetime() }).strict(),
  backoff: { initialDelaySeconds: 60, maxDelaySeconds: 3600, jitter: "equal" },
});
