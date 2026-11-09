import { and, desc, eq, getTableColumns } from "drizzle-orm";

import { user } from "../accounts";
import type { Database } from "../database";
import type { Clock } from "../kernel";
import { type Actor, requirePermission } from "../workspaces";
import {
  containerRunQuota,
  containerRuns,
  containerRunUserQuota,
} from "./container-runs.schema";
import {
  CONTAINER_RUN_PRESETS,
  CONTAINER_RUN_RETENTION_DAYS,
  CONTAINER_RUN_USER_HOURLY_LIMIT,
  type ContainerDemoAvailability,
  type ContainerDemoSettings,
  type ContainerDemoStatus,
  type ContainerRunSummary,
  type ListContainerRunsInput,
  listContainerRunsInputSchema,
  toContainerRunSummary,
  utcDay,
  utcHour,
} from "./domain";

/**
 * The actor's workspace's runs, newest first (`containers.read`), with whether the demo
 * takes a new run now and why not: CONTAINER_DEMO=off, today's daily cap used up, or the
 * actor's hourly limit reached (off wins, then the cap, then the limit).
 */
export async function listContainerRuns(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly settings: ContainerDemoSettings;
  },
  actor: Actor,
  input: ListContainerRunsInput
): Promise<{
  readonly items: readonly ContainerRunSummary[];
  readonly status: ContainerDemoStatus;
}> {
  requirePermission(actor, "containers.read");
  const parsed = listContainerRunsInputSchema.parse(input);
  const now = deps.clock.now();
  const [rows, [quota], [recent]] = await Promise.all([
    deps.db
      .select({ ...getTableColumns(containerRuns), createdByName: user.name })
      .from(containerRuns)
      .leftJoin(user, eq(user.id, containerRuns.createdBy))
      .where(eq(containerRuns.workspaceId, actor.workspaceId))
      .orderBy(desc(containerRuns.createdAt), desc(containerRuns.id))
      .limit(parsed.limit),
    deps.db
      .select({ count: containerRunQuota.count })
      .from(containerRunQuota)
      .where(eq(containerRunQuota.day, utcDay(now))),
    deps.db
      .select({ count: containerRunUserQuota.count })
      .from(containerRunUserQuota)
      .where(
        and(
          eq(containerRunUserQuota.userId, actor.userId),
          eq(containerRunUserQuota.hour, utcHour(now))
        )
      ),
  ]);
  const usedToday = quota?.count ?? 0;
  const usedThisHour = recent?.count ?? 0;
  const availability: ContainerDemoAvailability =
    deps.settings.mode === "off"
      ? { state: "off" }
      : usedToday >= deps.settings.dailyCap
        ? { state: "daily_cap_reached" }
        : usedThisHour >= CONTAINER_RUN_USER_HOURLY_LIMIT
          ? { state: "hourly_limit_reached" }
          : { state: "on" };
  return {
    items: rows.map(toContainerRunSummary),
    status: {
      availability,
      dailyCap: deps.settings.dailyCap,
      usedToday: Math.min(usedToday, deps.settings.dailyCap),
      hourlyLimit: CONTAINER_RUN_USER_HOURLY_LIMIT,
      usedThisHour: Math.min(usedThisHour, CONTAINER_RUN_USER_HOURLY_LIMIT),
      presets: CONTAINER_RUN_PRESETS,
      retentionDays: CONTAINER_RUN_RETENTION_DAYS,
    },
  };
}
