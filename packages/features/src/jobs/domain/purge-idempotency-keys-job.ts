import { z } from "zod";

import { defineJob } from "../../kernel";

/** Deletes expired idempotency keys; enqueued daily by the cron entry of the same name. */
export const purgeIdempotencyKeysJob = defineJob({
  type: "jobs.purge-idempotency-keys",
  payload: z.object({}).strict(),
  backoff: { initialDelaySeconds: 60, maxDelaySeconds: 3600, jitter: "equal" },
});
