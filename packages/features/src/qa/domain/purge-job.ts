import { z } from "zod";

import { defineJob } from "../../kernel";

/**
 * Deletes QA outbox mail older than 24 hours; enqueued daily by the cron entry of the same
 * name. `asOf` is the cron run's scheduled time, so every retry purges the same rows.
 */
export const purgeQaOutboxJob = defineJob({
  type: "qa-outbox.purge",
  payload: z.object({ asOf: z.iso.datetime() }).strict(),
  backoff: { initialDelaySeconds: 60, maxDelaySeconds: 3600, jitter: "equal" },
});
