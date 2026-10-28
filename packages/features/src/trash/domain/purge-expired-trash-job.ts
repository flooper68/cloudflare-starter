import { z } from "zod";

import { defineJob } from "../../kernel";

/**
 * Purges trash past each entity's retention; enqueued daily by the cron entry of the same
 * name. `asOf` is the cron run's scheduled time: every retry, and every follow-up the job
 * enqueues while a batch comes back full, purges against the same cutoff.
 */
export const purgeExpiredTrashJob = defineJob({
  type: "trash.purge-expired",
  payload: z.object({ asOf: z.iso.datetime() }).strict(),
  backoff: { initialDelaySeconds: 60, maxDelaySeconds: 3600, jitter: "equal" },
});
