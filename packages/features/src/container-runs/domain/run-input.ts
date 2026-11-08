import { z } from "zod";

/**
 * The digits a run may compute: a few presets, so every run takes seconds on the smallest
 * container instance (50,000 digits take about 5 s at 1/16 vCPU). The container itself
 * accepts up to 100,000 (MAX_DIGITS in apps/container/pi_task.py).
 */
export const CONTAINER_RUN_PRESETS = [1000, 10_000, 50_000] as const;
export type ContainerRunPreset = (typeof CONTAINER_RUN_PRESETS)[number];

/** Runs one user may start per rolling hour, across workspaces. */
export const CONTAINER_RUN_USER_HOURLY_LIMIT = 5;

/** Days a run and its result stay before the daily purge deletes them. */
export const CONTAINER_RUN_RETENTION_DAYS = 7;

/** Decimal places of the result kept in the row as its preview. */
export const CONTAINER_RUN_PREVIEW_DIGITS = 100;

export const CONTAINER_RUN_LIST_LIMIT_MAX = 50;

const preset = z.union(
  CONTAINER_RUN_PRESETS.map((value) => z.literal(value)) as [
    z.ZodLiteral<1000>,
    z.ZodLiteral<10_000>,
    z.ZodLiteral<50_000>,
  ],
  { error: "digits must be 1000, 10000 or 50000" }
);

/**
 * A new run of `digits`, or a retry of a failed run of the same workspace (`retryOf`),
 * which takes that run's digits. Exactly one of the two.
 */
export const startContainerRunInputSchema = z
  .object({
    digits: preset
      .optional()
      .describe("Digits of pi to compute: 1000, 10000 or 50000"),
    retryOf: z
      .uuid()
      .optional()
      .describe(
        "The id of a failed run to retry instead (from get_container_run); takes its digits"
      ),
  })
  .refine(
    (input) => (input.digits === undefined) !== (input.retryOf === undefined),
    {
      error: "give either digits or retryOf",
    }
  );
export type StartContainerRunInput = z.infer<
  typeof startContainerRunInputSchema
>;

export const containerRunRefSchema = z.object({ runId: z.uuid() });
export type ContainerRunRef = z.infer<typeof containerRunRefSchema>;

export const listContainerRunsInputSchema = z.object({
  limit: z.number().int().min(1).max(CONTAINER_RUN_LIST_LIMIT_MAX).default(20),
});
export type ListContainerRunsInput = z.input<
  typeof listContainerRunsInputSchema
>;
