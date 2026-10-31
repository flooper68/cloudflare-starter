import { z } from "zod";
import { defineJob } from "../../kernel";
/** Cleanup intents survive erased metadata; handlers recheck their current references. */
export const cleanupStorageJob = defineJob({
  type: "files.cleanup-storage",
  payload: z.object({ target: z.string().min(1).max(1024) }).strict(),
  backoff: { initialDelaySeconds: 60, maxDelaySeconds: 3600, jitter: "equal" },
});
export const retryFileCleanupsJob = defineJob({
  type: "files.retry-cleanup",
  payload: z.object({ cursor: z.string().optional() }).strict(),
  backoff: { initialDelaySeconds: 60, maxDelaySeconds: 3600, jitter: "equal" },
});
/** Existing presigned PUTs remain usable for an hour; expiry is not revocation. */
export const PRESIGNED_UPLOAD_CLEANUP_DELAY_SECONDS = 3600;
