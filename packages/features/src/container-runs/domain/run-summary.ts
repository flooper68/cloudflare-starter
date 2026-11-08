import {
  CONTAINER_RUN_PREVIEW_DIGITS,
  CONTAINER_RUN_RETENTION_DAYS,
} from "./run-input";
import {
  parseRunSteps,
  type RunErrorCode,
  type RunStatus,
  type RunStep,
  runDurationMs,
} from "./run-steps";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The R2 key of a run's result, under its workspace's prefix in the FILES bucket. */
export function containerRunResultKey(
  workspaceId: string,
  runId: string
): string {
  return `workspaces/${workspaceId}/container-runs/${runId}.txt`;
}

/** Matches the keys containerRunResultKey makes (storage reconciliation). */
export const CONTAINER_RUN_RESULT_KEY =
  /^workspaces\/[^/]+\/container-runs\/[^/]+\.txt$/;

/** The UTC day of `now` (YYYY-MM-DD): the daily cap's counter. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** The UTC hour of `now` (YYYY-MM-DDTHH): the per-user hourly limit's counter. */
export function utcHour(now: Date): string {
  return now.toISOString().slice(0, 13);
}

/** When a run accepted at `now` expires. */
export function containerRunExpiry(now: Date): Date {
  return new Date(now.getTime() + CONTAINER_RUN_RETENTION_DAYS * DAY_MS);
}

/** "3.14159…" cut to the preview's decimals. */
export function resultPreview(pi: string): string {
  const dot = pi.indexOf(".");
  return dot < 0 ? pi : pi.slice(0, dot + 1 + CONTAINER_RUN_PREVIEW_DIGITS);
}

/** The app path that downloads a run's result (GET, signed-in member of its workspace). */
export function containerRunDownloadHref(
  workspaceId: string,
  runId: string
): string {
  return `/api/container-runs/${runId}/result?workspaceId=${encodeURIComponent(workspaceId)}`;
}

/** A run row as the use cases read it. */
export interface ContainerRunRow {
  readonly id: string;
  readonly workspaceId: string;
  readonly createdBy: string | null;
  readonly createdByName: string | null;
  readonly digits: number;
  readonly status: string;
  readonly steps: string;
  readonly errorCode: string | null;
  readonly retryOf: string | null;
  readonly resultKey: string | null;
  readonly resultPreview: string | null;
  readonly resultBytes: number | null;
  readonly computeMs: number | null;
  readonly createdAt: Date;
  readonly finishedAt: Date | null;
  readonly expiresAt: Date;
}

/** A run as the API returns it (tRPC, MCP). */
export interface ContainerRunSummary {
  readonly id: string;
  readonly digits: number;
  readonly status: RunStatus;
  readonly steps: readonly RunStep[];
  readonly errorCode: RunErrorCode | null;
  readonly retryOf: string | null;
  readonly startedBy: { readonly id: string; readonly name: string } | null;
  readonly createdAt: string;
  readonly finishedAt: string | null;
  readonly expiresAt: string;
  /** Acceptance to the last finished step, once the run is over. */
  readonly durationMs: number | null;
  /** The container's own compute time. */
  readonly computeMs: number | null;
  readonly result: {
    readonly preview: string;
    readonly bytes: number;
    readonly downloadHref: string;
  } | null;
}

export function toContainerRunSummary(
  row: ContainerRunRow
): ContainerRunSummary {
  const steps = parseRunSteps(row.steps);
  return {
    id: row.id,
    digits: row.digits,
    status: row.status as RunStatus,
    steps,
    errorCode: (row.errorCode as RunErrorCode | null) ?? null,
    retryOf: row.retryOf,
    startedBy:
      row.createdBy && row.createdByName !== null
        ? { id: row.createdBy, name: row.createdByName }
        : null,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
    durationMs: runDurationMs(steps),
    computeMs: row.computeMs,
    result:
      row.resultKey && row.resultPreview !== null && row.resultBytes !== null
        ? {
            preview: row.resultPreview,
            bytes: row.resultBytes,
            downloadHref: containerRunDownloadHref(row.workspaceId, row.id),
          }
        : null,
  };
}

/** Whether the demo takes new runs right now, and why not. */
export type ContainerDemoAvailability =
  | { readonly state: "on" }
  | { readonly state: "off" }
  | { readonly state: "daily_cap_reached" }
  | { readonly state: "hourly_limit_reached" };

export interface ContainerDemoStatus {
  readonly availability: ContainerDemoAvailability;
  readonly dailyCap: number;
  readonly usedToday: number;
  readonly hourlyLimit: number;
  readonly usedThisHour: number;
  readonly presets: readonly number[];
  readonly retentionDays: number;
}
