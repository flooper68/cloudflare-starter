import { eq } from "drizzle-orm";

import type { Database } from "../database";
import type { Clock } from "../kernel";
import { containerRuns } from "./container-runs.schema";
import {
  beginRunStep,
  ContainerRunNotFoundError,
  parseRunSteps,
  type RunStepName,
  runStatusOf,
} from "./domain";

/**
 * Records that a workflow step of a run started (the timeline in `steps`, domain/run-steps.ts)
 * and returns what the step needs. Called by the run's Workflow at the start of each step,
 * inside that step, so a retried step records nothing new. A run that is gone (its
 * workspace was deleted) is not found: the workflow stops. A run that is over refuses
 * (RunStepTransitionError).
 */
export async function beginContainerRunStep(
  deps: { readonly db: Database; readonly clock: Clock },
  input: { readonly runId: string; readonly step: RunStepName }
): Promise<{
  readonly workspaceId: string;
  readonly digits: number;
  readonly createdBy: string | null;
}> {
  const [row] = await deps.db
    .select({
      workspaceId: containerRuns.workspaceId,
      digits: containerRuns.digits,
      createdBy: containerRuns.createdBy,
      steps: containerRuns.steps,
    })
    .from(containerRuns)
    .where(eq(containerRuns.id, input.runId));
  if (!row) throw new ContainerRunNotFoundError();
  const steps = beginRunStep(
    parseRunSteps(row.steps),
    input.step,
    deps.clock.now()
  );
  await deps.db
    .update(containerRuns)
    .set({ steps: JSON.stringify(steps), status: runStatusOf(steps) })
    .where(eq(containerRuns.id, input.runId));
  return {
    workspaceId: row.workspaceId,
    digits: row.digits,
    createdBy: row.createdBy,
  };
}
