import { Check, Circle, Minus, RotateCcw, X } from "lucide-react";

import { cn } from "../../lib/utils";
import { Badge, type Tone } from "../badge";
import { Button } from "../button";
import { Skeleton } from "../skeleton";
import { Spinner } from "../spinner";
import { RelativeTime } from "../timeline";

export type ContainerRunStepName =
  | "queued"
  | "starting"
  | "computing"
  | "storing"
  | "notifying"
  | "done";
export type ContainerRunStepStatus =
  | "pending"
  | "running"
  | "done"
  | "failed"
  | "skipped";
export type ContainerRunStatus = "queued" | "running" | "succeeded" | "failed";

export interface ContainerRunStepView {
  readonly name: ContainerRunStepName;
  readonly status: ContainerRunStepStatus;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
}

export interface ContainerRunView {
  readonly id: string;
  readonly digits: number;
  readonly status: ContainerRunStatus;
  readonly steps: readonly ContainerRunStepView[];
  readonly createdAt: string;
  readonly durationMs: number | null;
  /** A short reason a failed run gives ("The container did not start"). */
  readonly error?: string | null;
  readonly startedBy?: string | null;
}

const STEP_LABEL: Record<ContainerRunStepName, string> = {
  queued: "Queued",
  starting: "Starting container",
  computing: "Computing",
  storing: "Storing in R2",
  notifying: "Notifying",
  done: "Done",
};

const STATUS_LABEL: Record<ContainerRunStatus, string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
};

const STATUS_TONE: Record<ContainerRunStatus, Tone> = {
  queued: "neutral",
  running: "info",
  succeeded: "success",
  failed: "danger",
};

/** "820 ms", "4.2 s", "1 min 5 s". */
export function formatRunDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const minutes = Math.floor(ms / 60_000);
  return `${minutes} min ${Math.round((ms % 60_000) / 1000)} s`;
}

function stepDuration(step: ContainerRunStepView, now: number): string | null {
  if (!step.startedAt) return null;
  const end = step.finishedAt ? Date.parse(step.finishedAt) : now;
  return formatRunDuration(end - Date.parse(step.startedAt));
}

function StepIcon({ status }: { readonly status: ContainerRunStepStatus }) {
  switch (status) {
    case "running":
      return <Spinner className="size-3.5 text-info" />;
    case "done":
      return <Check aria-hidden className="size-3.5 text-success" />;
    case "failed":
      return <X aria-hidden className="size-3.5 text-danger" />;
    case "skipped":
      return <Minus aria-hidden className="size-3.5 text-fg-subtle" />;
    default:
      return <Circle aria-hidden className="size-3 text-fg-subtle" />;
  }
}

export interface ContainerRunStatusBadgeProps {
  readonly status: ContainerRunStatus;
  readonly className?: string;
}

/** A run's status as a badge: queued, running, succeeded or failed. */
export function ContainerRunStatusBadge({
  status,
  className,
}: ContainerRunStatusBadgeProps) {
  return (
    <Badge tone={STATUS_TONE[status]} className={className}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export interface ContainerRunTimelineProps {
  readonly steps: readonly ContainerRunStepView[];
  /** The time a running step's duration counts to; defaults to the time of the render. */
  readonly now?: number;
  readonly className?: string;
}

/**
 * The step timeline of a container workflow run: queued, starting the container,
 * computing, storing in R2, notifying, done. Each step shows its state and how long it
 * took (or has taken so far). Announces changes politely, so a screen reader hears a
 * step finish while the page polls.
 */
export function ContainerRunTimeline({
  steps,
  now = Date.now(),
  className,
}: ContainerRunTimelineProps) {
  return (
    <ol
      aria-label="Run steps"
      aria-live="polite"
      className={cn("flex flex-col", className)}
    >
      {steps.map((step, index) => {
        const duration = stepDuration(step, now);
        const last = index === steps.length - 1;
        return (
          <li
            key={step.name}
            data-step={step.name}
            data-status={step.status}
            className="relative flex gap-3 pb-3"
          >
            {last ? null : (
              <span
                aria-hidden
                className="absolute top-6 bottom-0 left-2.5 w-px -translate-x-1/2 bg-line"
              />
            )}
            <span className="relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-raised">
              <StepIcon status={step.status} />
            </span>
            <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3 pt-px text-sm">
              <span
                className={cn(
                  step.status === "pending" || step.status === "skipped"
                    ? "text-fg-muted"
                    : "font-medium text-fg"
                )}
              >
                {STEP_LABEL[step.name]}
                <span className="sr-only">: {step.status}</span>
              </span>
              {duration && step.name !== "done" ? (
                <span className="shrink-0 font-mono text-xs tabular-nums text-fg-muted">
                  {duration}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export interface ContainerRunListProps {
  readonly runs: readonly ContainerRunView[];
  /** Shows a run's timeline and result. */
  readonly onOpen: (id: string) => void;
  /** Retries a failed run; no Retry button without it. */
  readonly onRetry?: (id: string) => void;
  /** The run on show. */
  readonly selectedId?: string | null;
  /** Retry is off (the demo is off or a limit is reached). */
  readonly retryDisabled?: boolean;
  readonly className?: string;
}

/**
 * Past container runs of a workspace, newest first: the digits, status, when, and how
 * long; failed ones carry a Retry button. Each row is a group of its own buttons.
 */
export function ContainerRunList({
  runs,
  onOpen,
  onRetry,
  selectedId,
  retryDisabled = false,
  className,
}: ContainerRunListProps) {
  return (
    <ul
      aria-label="Past runs"
      className={cn(
        "overflow-hidden rounded-lg border border-line bg-surface-raised",
        className
      )}
    >
      {runs.map((run) => {
        const digits = `${run.digits.toLocaleString("en-US")} digits`;
        return (
          <li
            key={run.id}
            className={cn(
              "flex items-center gap-3 border-b border-line px-3 py-2 last:border-b-0",
              run.id === selectedId && "bg-active"
            )}
          >
            <button
              type="button"
              onClick={() => onOpen(run.id)}
              aria-current={run.id === selectedId ? "true" : undefined}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ContainerRunStatusBadge status={run.status} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-fg">
                  {digits}
                </span>
                <span className="block truncate text-xs text-fg-muted">
                  {run.startedBy ? `${run.startedBy} · ` : ""}
                  <RelativeTime date={run.createdAt} />
                  {run.durationMs !== null
                    ? ` · ${formatRunDuration(run.durationMs)}`
                    : ""}
                  {run.error ? ` · ${run.error}` : ""}
                </span>
              </span>
            </button>
            {run.status === "failed" && onRetry ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={retryDisabled}
                onClick={() => onRetry(run.id)}
                aria-label={`Retry ${digits}`}
              >
                <RotateCcw aria-hidden />
                Retry
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** The past runs while they load: rows shaped like runs. */
export function ContainerRunListSkeleton({
  rows = 3,
}: {
  readonly rows?: number;
}) {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-lg border border-line bg-surface-raised"
    >
      {Array.from({ length: rows }, (_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
          key={index}
          className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0"
        >
          <Skeleton className="h-5 w-16" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
      ))}
    </div>
  );
}
