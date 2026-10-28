import { z } from "zod";

import { defineJob } from "../../kernel";

/**
 * Lapses ended trials and unpaid or canceled subscriptions to their fallback plan;
 * enqueued daily by the cron entry of the same name. `asOf` is the cron run's scheduled
 * time, so every retry judges the same subscriptions (expireTrials is idempotent anyway).
 */
export const expireTrialsJob = defineJob({
  type: "billing.expire-trials",
  payload: z.object({ asOf: z.iso.datetime() }).strict(),
  backoff: { initialDelaySeconds: 60, maxDelaySeconds: 3600, jitter: "equal" },
});
