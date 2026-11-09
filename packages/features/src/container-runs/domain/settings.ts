import { z } from "zod";

/**
 * The container workflow demo's settings, all required, no defaults
 * (docs/guides/how-to-run-container-workflows.md#settings):
 * - CONTAINER_DEMO: on | off. Off refuses new runs and the page says why.
 * - CONTAINER_DEMO_DAILY_CAP: runs per UTC day for the whole deployment (1..10000).
 * - CONTAINER_DEMO_RUNNER: container (the pi container through the PI_CONTAINER_SERVICE
 *   service binding) | fake (computes pi in the Worker; local dev and tests, no Docker).
 */
export const CONTAINER_DEMO_MODES = ["on", "off"] as const;
export type ContainerDemoMode = (typeof CONTAINER_DEMO_MODES)[number];

export const CONTAINER_DEMO_RUNNERS = ["container", "fake"] as const;
export type ContainerDemoRunner = (typeof CONTAINER_DEMO_RUNNERS)[number];

/** The highest daily cap the setting accepts: a typo must not mean unlimited. */
export const CONTAINER_DEMO_DAILY_CAP_MAX = 10_000;

export interface ContainerDemoSettings {
  readonly mode: ContainerDemoMode;
  readonly dailyCap: number;
  readonly runner: ContainerDemoRunner;
}

const where = "in the vars of apps/web/wrangler.jsonc for every environment";

export const containerDemoSettingsSchema = z
  .object({
    CONTAINER_DEMO: z.enum(CONTAINER_DEMO_MODES, {
      error: `CONTAINER_DEMO must be on or off (required, no default; set it ${where})`,
    }),
    CONTAINER_DEMO_DAILY_CAP: z
      .string({
        error: `CONTAINER_DEMO_DAILY_CAP is not set: set it to a whole number of runs per day (1-${CONTAINER_DEMO_DAILY_CAP_MAX}) ${where}`,
      })
      .regex(/^[1-9]\d*$/, {
        error: `CONTAINER_DEMO_DAILY_CAP must be a whole number of runs per day (1-${CONTAINER_DEMO_DAILY_CAP_MAX})`,
      })
      .transform(Number)
      .pipe(
        z
          .number()
          .int()
          .min(1)
          .max(CONTAINER_DEMO_DAILY_CAP_MAX, {
            error: `CONTAINER_DEMO_DAILY_CAP must be at most ${CONTAINER_DEMO_DAILY_CAP_MAX}`,
          })
      ),
    CONTAINER_DEMO_RUNNER: z.enum(CONTAINER_DEMO_RUNNERS, {
      error: `CONTAINER_DEMO_RUNNER must be container or fake (required, no default; set it ${where})`,
    }),
  })
  .transform(
    (raw): ContainerDemoSettings => ({
      mode: raw.CONTAINER_DEMO,
      dailyCap: raw.CONTAINER_DEMO_DAILY_CAP,
      runner: raw.CONTAINER_DEMO_RUNNER,
    })
  );
