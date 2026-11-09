import { z } from "zod";

/**
 * The step timeline of a container run, a small state machine. Pure: callers pass the
 * time. Steps run in this order, one at a time:
 *
 *   queued → starting (the container) → computing → storing (R2) → notifying → done
 *
 * `queued` starts when the run is accepted. Starting a step ends the one running before
 * it; starting the step that is already running does nothing (a Workflows retry of that
 * step). A failure fails the running step and skips the rest. A step can only start after
 * every step before it is done, so the timeline never goes backwards.
 */
export const RUN_STEP_NAMES = [
  "queued",
  "starting",
  "computing",
  "storing",
  "notifying",
  "done",
] as const;
export type RunStepName = (typeof RUN_STEP_NAMES)[number];

export const RUN_STEP_STATUSES = [
  "pending",
  "running",
  "done",
  "failed",
  "skipped",
] as const;
export type RunStepStatus = (typeof RUN_STEP_STATUSES)[number];

/** The run as a whole: queued until a workflow step starts, then running, then final. */
export const RUN_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

/** Why a run failed, shown to the user; never a raw error message. */
export const RUN_ERROR_CODES = [
  "container_unavailable",
  "compute_failed",
  "storage_failed",
  "workflow_unavailable",
  "internal",
] as const;
export type RunErrorCode = (typeof RUN_ERROR_CODES)[number];

export const runStepSchema = z
  .object({
    name: z.enum(RUN_STEP_NAMES),
    status: z.enum(RUN_STEP_STATUSES),
    startedAt: z.iso.datetime().nullable(),
    finishedAt: z.iso.datetime().nullable(),
  })
  .strict();
export type RunStep = z.infer<typeof runStepSchema>;

export const runStepsSchema = z
  .array(runStepSchema)
  .length(RUN_STEP_NAMES.length);

/** A step was started out of order, or the run is already over. */
export class RunStepTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunStepTransitionError";
  }
}

/** The timeline of a run accepted at `now`: `queued` running, the rest pending. */
export function newRunSteps(now: Date): RunStep[] {
  return RUN_STEP_NAMES.map((name) =>
    name === "queued"
      ? {
          name,
          status: "running",
          startedAt: now.toISOString(),
          finishedAt: null,
        }
      : { name, status: "pending", startedAt: null, finishedAt: null }
  );
}

/** Parses a stored timeline (the `steps` column). */
export function parseRunSteps(json: string): RunStep[] {
  return runStepsSchema.parse(JSON.parse(json));
}

function isOver(steps: readonly RunStep[]): boolean {
  return steps.some(
    (step) =>
      step.status === "failed" ||
      (step.name === "done" && step.status === "done")
  );
}

/**
 * Starts `name` at `now`, ending the running step before it. Starting the running step
 * again is a no-op (a retried workflow step). `done` is finished as soon as it starts.
 */
export function beginRunStep(
  steps: readonly RunStep[],
  name: RunStepName,
  now: Date
): RunStep[] {
  if (isOver(steps)) {
    throw new RunStepTransitionError(`cannot start ${name}: the run is over`);
  }
  const index = RUN_STEP_NAMES.indexOf(name);
  const target = steps[index];
  if (!target) throw new RunStepTransitionError(`unknown step ${name}`);
  if (target.status === "running") return [...steps];
  if (target.status !== "pending") {
    throw new RunStepTransitionError(
      `cannot start ${name}: it is ${target.status}`
    );
  }
  const at = now.toISOString();
  return steps.map((step, position) => {
    if (position < index) {
      if (step.status === "running") {
        return { ...step, status: "done", finishedAt: at };
      }
      if (step.status !== "done") {
        throw new RunStepTransitionError(
          `cannot start ${name}: ${step.name} is ${step.status}`
        );
      }
      return step;
    }
    if (position === index) {
      return name === "done"
        ? { ...step, status: "done", startedAt: at, finishedAt: at }
        : { ...step, status: "running", startedAt: at };
    }
    return step;
  });
}

/**
 * Fails the run at `now`: `failedStep` fails when it is given and has not finished (the
 * step whose work failed, even if it failed before recording its start, which ends the
 * step running before it); otherwise the running step fails, or the first pending one
 * when the failure came between steps. Every later step is skipped. A finished run stays
 * as it is.
 */
export function failRunSteps(
  steps: readonly RunStep[],
  now: Date,
  failedStep?: RunStepName
): RunStep[] {
  if (isOver(steps)) return [...steps];
  const at = now.toISOString();
  const named = failedStep ? RUN_STEP_NAMES.indexOf(failedStep) : -1;
  const running = steps.findIndex((step) => step.status === "running");
  const failedAt =
    named >= 0 && steps[named]?.status !== "done"
      ? named
      : running >= 0
        ? running
        : steps.findIndex((step) => step.status === "pending");
  if (named >= 0 && failedAt === named) {
    steps = steps.map((step, position) =>
      position < named && step.status === "running"
        ? { ...step, status: "done", finishedAt: at }
        : step
    );
  }
  return steps.map((step, position) => {
    if (position === failedAt) {
      return {
        ...step,
        status: "failed",
        startedAt: step.startedAt ?? at,
        finishedAt: at,
      };
    }
    if (position > failedAt && step.status === "pending") {
      return { ...step, status: "skipped" };
    }
    return step;
  });
}

/** The run's status from its timeline. */
export function runStatusOf(steps: readonly RunStep[]): RunStatus {
  if (steps.some((step) => step.status === "failed")) return "failed";
  if (steps.some((step) => step.name === "done" && step.status === "done")) {
    return "succeeded";
  }
  return steps.some(
    (step) => step.name !== "queued" && step.status !== "pending"
  )
    ? "running"
    : "queued";
}

/** Milliseconds from acceptance to the end of the last finished step, or null. */
export function runDurationMs(steps: readonly RunStep[]): number | null {
  const started = steps[0]?.startedAt;
  const ends = steps
    .map((step) => step.finishedAt)
    .filter((value): value is string => value !== null);
  const last = ends.at(-1);
  if (!started || !last || !isOver(steps)) return null;
  return Date.parse(last) - Date.parse(started);
}
