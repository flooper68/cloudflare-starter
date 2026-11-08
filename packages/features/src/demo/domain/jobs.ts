import { z } from "zod";

import { defineJob } from "../../kernel";

/**
 * Adds the sample notes to a new demo workspace. Enqueued once from the sign-up hook;
 * keyed by workspace, and the use case also skips a workspace that already has notes.
 */
export const seedDemoWorkspaceJob = defineJob({
  type: "demo.seed-workspace",
  payload: z
    .object({ userId: z.string().min(1), workspaceId: z.string().min(1) })
    .strict(),
  backoff: { initialDelaySeconds: 10, maxDelaySeconds: 600, jitter: "equal" },
  idempotencyKey: (payload) => payload.workspaceId,
});

/**
 * One batch of the daily demo retention: the first batch enqueues the warnings; every
 * batch erases up to DEMO_ERASE_BATCH due accounts and continues with `batch + 1` while
 * a batch comes back full (up to DEMO_MAX_BATCHES_PER_RUN). `asOf` is the cron run's
 * time, so every retry and continuation judges the same accounts.
 */
export const enforceDemoRetentionJob = defineJob({
  type: "demo.enforce-retention",
  payload: z
    .object({
      asOf: z.iso.datetime(),
      batch: z.number().int().nonnegative(),
      /** Accounts earlier batches of this run could not erase (they come first). */
      skip: z.number().int().nonnegative().optional(),
    })
    .strict(),
  backoff: { initialDelaySeconds: 60, maxDelaySeconds: 3600, jitter: "equal" },
  idempotencyKey: (payload) => `${payload.asOf}:${payload.batch}`,
});

/** Sends one account its "deleted tomorrow" warning; keyed by user. */
export const warnDemoAccountJob = defineJob({
  type: "demo.warn-account",
  payload: z
    .object({ userId: z.string().min(1), asOf: z.iso.datetime() })
    .strict(),
  backoff: { initialDelaySeconds: 30, maxDelaySeconds: 3600, jitter: "equal" },
  idempotencyKey: (payload) => payload.userId,
});
