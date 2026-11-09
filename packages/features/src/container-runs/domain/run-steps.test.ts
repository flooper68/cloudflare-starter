import { describe, expect, it } from "vitest";

import {
  beginRunStep,
  failRunSteps,
  newRunSteps,
  parseRunSteps,
  RUN_STEP_NAMES,
  type RunStep,
  RunStepTransitionError,
  runDurationMs,
  runStatusOf,
} from "./run-steps";

const t = (second: number) => new Date(Date.UTC(2026, 10, 8, 12, 0, second));
const iso = (second: number) => t(second).toISOString();

const statuses = (steps: readonly RunStep[]) =>
  Object.fromEntries(steps.map((step) => [step.name, step.status]));

/** A run that went through every step, one second each. */
function completed(): RunStep[] {
  let steps = newRunSteps(t(0));
  RUN_STEP_NAMES.slice(1).forEach((name, index) => {
    steps = beginRunStep(steps, name, t(index + 1));
  });
  return steps;
}

describe("run steps", () => {
  it("starts with queued running and every other step pending", () => {
    const steps = newRunSteps(t(0));
    expect(steps.map((step) => step.name)).toEqual([...RUN_STEP_NAMES]);
    expect(statuses(steps)).toEqual({
      queued: "running",
      starting: "pending",
      computing: "pending",
      storing: "pending",
      notifying: "pending",
      done: "pending",
    });
    expect(steps[0]).toMatchObject({ startedAt: iso(0), finishedAt: null });
    expect(runStatusOf(steps)).toBe("queued");
  });

  it("starting a step ends the running one, with timings", () => {
    const steps = beginRunStep(newRunSteps(t(0)), "starting", t(2));
    expect(steps[0]).toMatchObject({
      status: "done",
      startedAt: iso(0),
      finishedAt: iso(2),
    });
    expect(steps[1]).toMatchObject({
      status: "running",
      startedAt: iso(2),
      finishedAt: null,
    });
    expect(runStatusOf(steps)).toBe("running");
  });

  it("finishes done as soon as it starts, and the run succeeds", () => {
    const steps = completed();
    expect(Object.values(statuses(steps))).toEqual(
      RUN_STEP_NAMES.map(() => "done")
    );
    expect(steps.at(-1)).toMatchObject({
      startedAt: iso(5),
      finishedAt: iso(5),
    });
    expect(runStatusOf(steps)).toBe("succeeded");
    expect(runDurationMs(steps)).toBe(5000);
  });

  it("starting the running step again changes nothing (a retried workflow step)", () => {
    const once = beginRunStep(newRunSteps(t(0)), "starting", t(1));
    expect(beginRunStep(once, "starting", t(9))).toEqual(once);
  });

  it("refuses to skip a step or go backwards", () => {
    const queued = newRunSteps(t(0));
    expect(() => beginRunStep(queued, "computing", t(1))).toThrow(
      RunStepTransitionError
    );
    const computing = beginRunStep(
      beginRunStep(queued, "starting", t(1)),
      "computing",
      t(2)
    );
    expect(() => beginRunStep(computing, "starting", t(3))).toThrow(
      /starting: it is done/
    );
  });

  it("refuses any step once the run is over", () => {
    expect(() => beginRunStep(completed(), "done", t(9))).toThrow(
      /the run is over/
    );
    const failed = failRunSteps(newRunSteps(t(0)), t(1));
    expect(() => beginRunStep(failed, "starting", t(2))).toThrow(
      /the run is over/
    );
  });

  it("a failure fails the running step and skips the rest", () => {
    const computing = beginRunStep(
      beginRunStep(newRunSteps(t(0)), "starting", t(1)),
      "computing",
      t(2)
    );
    const failed = failRunSteps(computing, t(4));
    expect(statuses(failed)).toEqual({
      queued: "done",
      starting: "done",
      computing: "failed",
      storing: "skipped",
      notifying: "skipped",
      done: "skipped",
    });
    expect(failed[2]).toMatchObject({ startedAt: iso(2), finishedAt: iso(4) });
    expect(runStatusOf(failed)).toBe("failed");
    expect(runDurationMs(failed)).toBe(4000);
  });

  it("a failure between steps fails the next pending one", () => {
    const between = newRunSteps(t(0)).map((step) =>
      step.name === "queued"
        ? { ...step, status: "done" as const, finishedAt: iso(1) }
        : step
    );
    const failed = failRunSteps(between, t(3));
    expect(failed[1]).toMatchObject({
      status: "failed",
      startedAt: iso(3),
      finishedAt: iso(3),
    });
  });

  it("fails the named step even when it failed before recording its start", () => {
    const failed = failRunSteps(newRunSteps(t(0)), t(3), "starting");
    expect(statuses(failed)).toEqual({
      queued: "done",
      starting: "failed",
      computing: "skipped",
      storing: "skipped",
      notifying: "skipped",
      done: "skipped",
    });
    expect(failed[0]).toMatchObject({ finishedAt: iso(3) });
    // A named step that already finished: the running one fails instead.
    const computing = beginRunStep(
      beginRunStep(newRunSteps(t(0)), "starting", t(1)),
      "computing",
      t(2)
    );
    expect(statuses(failRunSteps(computing, t(4), "starting")).computing).toBe(
      "failed"
    );
  });

  it("failing a finished run leaves it as it is", () => {
    expect(failRunSteps(completed(), t(9))).toEqual(completed());
  });

  it("has no duration until the run is over", () => {
    expect(runDurationMs(newRunSteps(t(0)))).toBeNull();
  });

  it("parses what it stores and refuses a broken timeline", () => {
    const steps = completed();
    expect(parseRunSteps(JSON.stringify(steps))).toEqual(steps);
    expect(() => parseRunSteps(JSON.stringify(steps.slice(1)))).toThrow();
    expect(() =>
      parseRunSteps(
        JSON.stringify([{ ...steps[0], status: "lost" }, ...steps.slice(1)])
      )
    ).toThrow();
  });
});
