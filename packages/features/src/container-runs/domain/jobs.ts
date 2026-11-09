import { z } from "zod";

import { defineJob } from "../../kernel";

/** Daily: deletes runs past their `expires_at`, results first (cron `container-runs.purge`). */
export const purgeContainerRunsJob = defineJob({
  type: "container-runs.purge",
  payload: z.object({ asOf: z.iso.datetime() }).strict(),
  backoff: { initialDelaySeconds: 60, maxDelaySeconds: 3600, jitter: "equal" },
});
