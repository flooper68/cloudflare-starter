import { eq } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { containerRuns } from "./container-runs.schema";
import {
  beginRunStep,
  ContainerRunNotFoundError,
  failRunSteps,
  parseRunSteps,
  type RunErrorCode,
  type RunStepName,
  runDurationMs,
  runStatusOf,
} from "./domain";

/**
 * Ends a run: `succeeded` starts (and so finishes) its `done` step; `failed` fails the
 * failed step (or the running one) with a stable error code and skips the rest. Records
 * `container_run.finished` as the system. A run that is already over is left as it is
 * and records nothing (a retried workflow step); the result says whether it changed.
 */
export async function finishContainerRun(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  input:
    | { readonly runId: string; readonly outcome: "succeeded" }
    | {
        readonly runId: string;
        readonly outcome: "failed";
        readonly errorCode: RunErrorCode;
        /** The step whose work failed, if known (it may have failed before it began). */
        readonly step?: RunStepName;
      }
): Promise<{ readonly changed: boolean }> {
  const [row] = await deps.db
    .select({
      workspaceId: containerRuns.workspaceId,
      digits: containerRuns.digits,
      status: containerRuns.status,
      steps: containerRuns.steps,
    })
    .from(containerRuns)
    .where(eq(containerRuns.id, input.runId));
  if (!row) throw new ContainerRunNotFoundError();
  if (row.status === "succeeded" || row.status === "failed") {
    return { changed: false };
  }
  const now = deps.clock.now();
  const current = parseRunSteps(row.steps);
  const steps =
    input.outcome === "succeeded"
      ? beginRunStep(current, "done", now)
      : failRunSteps(current, now, input.step);
  const status = runStatusOf(steps);
  await deps.db
    .update(containerRuns)
    .set({
      steps: JSON.stringify(steps),
      status,
      finishedAt: now,
      errorCode: input.outcome === "failed" ? input.errorCode : null,
    })
    .where(eq(containerRuns.id, input.runId));

  await recordAuditEvent(deps, deps.requestContext, {
    action: "container_run.finished",
    outcome: input.outcome === "succeeded" ? "success" : "failure",
    actor: { kind: "system" },
    workspaceId: row.workspaceId,
    target: { type: "container_run", id: input.runId },
    metadata: {
      digits: row.digits,
      durationMs: runDurationMs(steps) ?? 0,
      failure: input.outcome === "failed" ? input.errorCode : null,
    },
  });
  return { changed: true };
}
