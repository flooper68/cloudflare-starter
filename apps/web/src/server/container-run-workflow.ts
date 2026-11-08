/**
 * The Workflow of one container run (the container workflow demo,
 * docs/guides/how-to-run-container-workflows.md). Each step records its start in the run's
 * timeline (beginContainerRunStep) inside the step itself, so a retried step records
 * nothing twice, and Workflows persists each step's result, so a replay never repeats a
 * finished step:
 *
 *   start container (warm the instance, retried) → compute (pi, in the container)
 *   → store (R2) → notify (in-app, email per preferences) → done
 *
 * Any failure fails the run with a stable error code, tells the person who started it,
 * and fails the instance (visible in the Workflows dashboard).
 */
import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import {
  beginContainerRunStep,
  ContainerRunNotFoundError,
  createRequestContext,
  finishContainerRun,
  notify,
  notifyContainerRunFinished,
  PiComputerError,
  type RequestContext,
  type RunErrorCode,
  type RunStepName,
  randomIds,
  storeContainerRunResult,
  systemClock,
} from "@cloudflare-starter/features";

import { buildRequiredConfig } from "@/lib/env";
import { containerInstanceOf, piComputerFor } from "@/server/container-runs";
import { getDb } from "@/server/db";
import type { AppEnv } from "@/server/env";
import { buildPlatform, loggerFor } from "@/server/platform";

export interface ContainerRunParams {
  readonly runId: string;
}

/**
 * Waking a container can fail right after a deploy or while it provisions: retry. The
 * timeouts bound a run's billed container time (at most about 7 minutes with every retry;
 * docs/guides/how-to-run-container-workflows.md#what-it-costs).
 */
const START_CONFIG = {
  retries: { limit: 3, delay: "5 seconds", backoff: "exponential" },
  timeout: "1 minute",
} as const;
/** 50,000 digits take about 5 s on a lite instance; one retry for a lost instance. */
const COMPUTE_CONFIG = {
  retries: { limit: 1, delay: "5 seconds", backoff: "constant" },
  timeout: "1 minute",
} as const;
const STEP_CONFIG = {
  retries: { limit: 3, delay: "2 seconds", backoff: "exponential" },
  timeout: "1 minute",
} as const;

/** Which failure code a failed step gives the run. */
const ERROR_OF_STEP: Readonly<Partial<Record<RunStepName, RunErrorCode>>> = {
  starting: "container_unavailable",
  computing: "compute_failed",
  storing: "storage_failed",
};

export class ContainerRunWorkflow extends WorkflowEntrypoint<
  AppEnv,
  ContainerRunParams
> {
  async run(
    event: Readonly<WorkflowEvent<ContainerRunParams>>,
    step: WorkflowStep
  ): Promise<{ readonly runId: string; readonly outcome: string }> {
    const { runId } = event.payload;
    const env = this.env;
    const platform = buildPlatform(env);
    const db = getDb(env);
    const settings = buildRequiredConfig(env).containerDemo;
    const instance = containerInstanceOf(runId);
    const context = (): RequestContext =>
      createRequestContext(
        { ids: randomIds },
        {
          source: "workflow",
          release: platform.release,
          environment: platform.environment,
        }
      );
    const deps = (requestContext: RequestContext) => ({
      db,
      clock: systemClock,
      ids: randomIds,
      bucket: env.FILES,
      requestContext,
      notify: (
        definition: Parameters<typeof notify>[1],
        input: Parameters<typeof notify>[2]
      ) =>
        notify(
          {
            jobQueue: platform.jobQueue,
            clock: systemClock,
            ids: randomIds,
            errors: platform.errors,
          },
          definition,
          input
        ),
    });
    /** A run that is gone (its workspace was deleted) stops the workflow without retries. */
    const begin = async (
      name: Parameters<typeof beginContainerRunStep>[1]["step"]
    ) => {
      try {
        return await beginContainerRunStep(
          { db, clock: systemClock },
          { runId, step: name }
        );
      } catch (error) {
        if (error instanceof ContainerRunNotFoundError) {
          throw new NonRetryableError(
            "container run not found",
            "ContainerRunNotFound"
          );
        }
        throw error;
      }
    };

    let current: RunStepName = "starting";
    try {
      await step.do("start container", START_CONFIG, async () => {
        await begin("starting");
        await piComputerFor(env, settings).warm(instance);
        return { instance };
      });

      current = "computing";
      const result = await step.do("compute", COMPUTE_CONFIG, async () => {
        const run = await begin("computing");
        try {
          const computed = await piComputerFor(env, settings).compute(
            run.digits,
            instance
          );
          return { pi: computed.pi, elapsedMs: computed.elapsedMs };
        } catch (error) {
          // A refused task fails the same way again: no retry.
          if (error instanceof PiComputerError && error.failure === "failed") {
            throw new NonRetryableError(error.message, "PiComputeFailed");
          }
          throw error;
        }
      });

      current = "storing";
      await step.do("store result", STEP_CONFIG, async () => {
        await begin("storing");
        const stored = await storeContainerRunResult(
          { db, bucket: env.FILES },
          { runId, pi: result.pi, computeMs: result.elapsedMs }
        );
        return { bytes: stored.bytes };
      });

      current = "notifying";
      await step.do("notify", STEP_CONFIG, async () => {
        await begin("notifying");
        const sent = await notifyContainerRunFinished(deps(context()), {
          runId,
          outcome: "succeeded",
        });
        return { status: sent.status };
      });

      current = "done";
      await step.do("done", STEP_CONFIG, async () => {
        await finishContainerRun(deps(context()), {
          runId,
          outcome: "succeeded",
        });
        return { done: true };
      });
      return { runId, outcome: "succeeded" };
    } catch (error) {
      const errorCode = ERROR_OF_STEP[current] ?? "internal";
      const requestContext = context();
      const fields = {
        "app.container_run.id": runId,
        "app.container_run.step": current,
        "app.container_run.error_code": errorCode,
      };
      // A container that would not start or refused the task is expected now and then and
      // only logged; anything else (a bug, a missing binding, storage) is reported once.
      const expected =
        error instanceof PiComputerError ||
        (error instanceof Error &&
          ["PiComputeFailed", "ContainerRunNotFound"].includes(error.name)) ||
        current === "starting";
      if (expected) {
        loggerFor(platform, requestContext).warn("container_run.failed", {
          ...fields,
          error,
        });
      } else {
        platform.errors.capture(error, requestContext, fields);
      }
      await step.do("record failure", STEP_CONFIG, async () => {
        try {
          const finished = await finishContainerRun(deps(context()), {
            runId,
            outcome: "failed",
            errorCode,
            step: current,
          });
          if (finished.changed) {
            await notifyContainerRunFinished(deps(context()), {
              runId,
              outcome: "failed",
            });
          }
          return { recorded: finished.changed };
        } catch (cause) {
          // Nothing to record for a run that is gone.
          if (cause instanceof ContainerRunNotFoundError)
            return { recorded: false };
          throw cause;
        }
      });
      throw error;
    }
  }
}
