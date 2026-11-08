import { and, eq, sql } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import type { ProductAnalytics } from "../platform";
import { trackEvent } from "../product-analytics";
import { type Actor, requirePermission } from "../workspaces";
import {
  containerRunQuota,
  containerRuns,
  containerRunUserQuota,
} from "./container-runs.schema";
import {
  CONTAINER_RUN_USER_HOURLY_LIMIT,
  ContainerDemoDailyCapError,
  ContainerDemoOffError,
  type ContainerDemoSettings,
  ContainerRunHourlyLimitError,
  ContainerRunNotFoundError,
  ContainerRunNotRetryableError,
  type ContainerRunWorkflows,
  containerRunExpiry,
  containerRunStartedEvent,
  failRunSteps,
  newRunSteps,
  type StartContainerRunInput,
  startContainerRunInputSchema,
  utcDay,
  utcHour,
} from "./domain";

/**
 * Starts a container run in the actor's workspace: digits of pi computed by the pi
 * container, orchestrated by the run's Workflow (docs/guides/how-to-run-container-workflows.md).
 * Checks, in order: the permission (`containers.run`), CONTAINER_DEMO=on, the retried run
 * (same workspace, failed), then takes one of the person's CONTAINER_RUN_USER_HOURLY_LIMIT
 * runs of this UTC hour (across workspaces) and one of today's CONTAINER_DEMO_DAILY_CAP
 * runs, each with an atomic upsert (a full day gives the hour's slot back). Then writes the run (queued), starts its workflow, and records
 * `container_run.started` and the `container_runs.started` product event. A workflow that
 * cannot start fails the run (`workflow_unavailable`) and the error is rethrown.
 * Both counters are kept apart from the runs, so deleting a workspace gives nothing back.
 */
export async function startContainerRun(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly analytics: ProductAnalytics;
    readonly settings: ContainerDemoSettings;
    readonly workflows: ContainerRunWorkflows;
  },
  actor: Actor,
  input: StartContainerRunInput
): Promise<{ readonly runId: string; readonly status: "queued" }> {
  requirePermission(actor, "containers.run");
  const parsed = startContainerRunInputSchema.parse(input);
  if (deps.settings.mode === "off") throw new ContainerDemoOffError();

  let digits = parsed.digits;
  if (parsed.retryOf) {
    const [original] = await deps.db
      .select({ digits: containerRuns.digits, status: containerRuns.status })
      .from(containerRuns)
      .where(
        and(
          eq(containerRuns.id, parsed.retryOf),
          eq(containerRuns.workspaceId, actor.workspaceId)
        )
      );
    if (!original) throw new ContainerRunNotFoundError();
    if (original.status !== "failed") throw new ContainerRunNotRetryableError();
    digits = original.digits as typeof digits;
  }
  if (digits === undefined) throw new ContainerRunNotFoundError();

  const now = deps.clock.now();
  const user = and(
    eq(containerRunUserQuota.userId, actor.userId),
    eq(containerRunUserQuota.hour, utcHour(now))
  );
  // One statement each: a counter only grows while it is under its limit.
  const mine = await deps.db
    .insert(containerRunUserQuota)
    .values({ userId: actor.userId, hour: utcHour(now), count: 1 })
    .onConflictDoUpdate({
      target: [containerRunUserQuota.userId, containerRunUserQuota.hour],
      set: { count: sql`${containerRunUserQuota.count} + 1` },
      setWhere: sql`${containerRunUserQuota.count} < ${CONTAINER_RUN_USER_HOURLY_LIMIT}`,
    })
    .returning({ count: containerRunUserQuota.count });
  if (mine.length === 0) {
    throw new ContainerRunHourlyLimitError(CONTAINER_RUN_USER_HOURLY_LIMIT);
  }

  const taken = await deps.db
    .insert(containerRunQuota)
    .values({ day: utcDay(now), count: 1 })
    .onConflictDoUpdate({
      target: containerRunQuota.day,
      set: { count: sql`${containerRunQuota.count} + 1` },
      setWhere: sql`${containerRunQuota.count} < ${deps.settings.dailyCap}`,
    })
    .returning({ count: containerRunQuota.count });
  if (taken.length === 0) {
    // The day is full: the person's slot for this hour was not used.
    await deps.db
      .update(containerRunUserQuota)
      .set({ count: sql`${containerRunUserQuota.count} - 1` })
      .where(user);
    throw new ContainerDemoDailyCapError(deps.settings.dailyCap);
  }

  const runId = deps.ids.uuid();
  const steps = newRunSteps(now);
  await deps.db.insert(containerRuns).values({
    id: runId,
    workspaceId: actor.workspaceId,
    createdBy: actor.userId,
    digits,
    status: "queued",
    steps: JSON.stringify(steps),
    retryOf: parsed.retryOf ?? null,
    createdAt: now,
    expiresAt: containerRunExpiry(now),
  });

  await recordAuditEvent(deps, deps.requestContext, {
    action: "container_run.started",
    actor: { kind: "user", userId: actor.userId },
    workspaceId: actor.workspaceId,
    target: { type: "container_run", id: runId },
    metadata: { digits, retryOf: parsed.retryOf ?? null },
  });

  try {
    await deps.workflows.start({ runId });
  } catch (error) {
    const failed = failRunSteps(steps, deps.clock.now());
    await deps.db
      .update(containerRuns)
      .set({
        status: "failed",
        steps: JSON.stringify(failed),
        errorCode: "workflow_unavailable",
        finishedAt: deps.clock.now(),
      })
      .where(eq(containerRuns.id, runId));
    throw error;
  }

  trackEvent(
    deps,
    {
      ...deps.requestContext,
      userId: actor.userId,
      workspaceId: actor.workspaceId,
    },
    containerRunStartedEvent,
    {
      digits: String(digits) as "1000" | "10000" | "50000",
      kind: parsed.retryOf ? "retry" : "new",
    }
  );
  return { runId, status: "queued" };
}
