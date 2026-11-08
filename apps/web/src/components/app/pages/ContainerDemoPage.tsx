import {
  Button,
  Callout,
  Card,
  CardDescription,
  CardTitle,
  ContainerRunList,
  ContainerRunListSkeleton,
  ContainerRunStatusBadge,
  ContainerRunTimeline,
  type ContainerRunView,
  DataState,
  EmptyState,
  ErrorState,
  formatRunDuration,
  SegmentedControl,
  SegmentedControlItem,
  Skeleton,
} from "@cloudflare-starter/ui";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Boxes, Download, Play, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { useWorkspace } from "@/components/shared/spa/workspace-context";
import {
  errorReference,
  UNEXPECTED_ERROR_MESSAGE,
} from "@/lib/error-reference";
import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";

type RunList = Awaited<ReturnType<typeof trpc.containerRuns.list.query>>;
type Run = RunList["items"][number];
type Availability = RunList["status"]["availability"]["state"];

/** How often a queued or running run is read again. */
const POLL_MS = 1000;

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  container_unavailable: "The container did not start",
  compute_failed: "The container could not compute the digits",
  storage_failed: "The result could not be stored",
  workflow_unavailable: "The workflow could not start",
  internal: "Something went wrong",
};

const UNAVAILABLE: Readonly<
  Record<Exclude<Availability, "on">, { title: string; description: string }>
> = {
  off: {
    title: "The container demo is off here",
    description:
      "This environment does not start containers (CONTAINER_DEMO=off). Past runs stay visible until they expire.",
  },
  daily_cap_reached: {
    title: "Today's container runs are used up",
    description:
      "This public demo starts a limited number of containers a day to keep its cost fixed. It opens again at 00:00 UTC.",
  },
  hourly_limit_reached: {
    title: "You started the most runs allowed in an hour",
    description:
      "Each person can start a few runs an hour. Try again later, or look at a past run below.",
  },
};

function toView(run: Run): ContainerRunView {
  return {
    id: run.id,
    digits: run.digits,
    status: run.status,
    steps: run.steps,
    createdAt: run.createdAt,
    durationMs: run.durationMs,
    error: run.errorCode ? (ERROR_MESSAGES[run.errorCode] ?? null) : null,
    startedBy: run.startedBy?.name ?? null,
  };
}

const isActive = (run: Run | undefined) =>
  run?.status === "queued" || run?.status === "running";

/** Reads one run and keeps reading it every second while it is queued or running. */
function useRun(workspaceId: string, runId: string | null) {
  const [run, setRun] = useState<Run | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    setRun(undefined);
    setError(null);
    if (!runId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const next = await trpc.containerRuns.get.query({ workspaceId, runId });
        if (stopped) return;
        setRun(next);
        if (isActive(next)) timer = setTimeout(load, POLL_MS);
      } catch (cause) {
        if (!stopped) setError(cause);
      }
    };
    void load();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [workspaceId, runId]);
  return { run, error };
}

function RunDetail({
  run,
  onRetry,
  retryDisabled,
}: {
  readonly run: Run;
  readonly onRetry: (id: string) => void;
  readonly retryDisabled: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isActive(run)) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [run]);
  const digits = run.digits.toLocaleString("en-US");
  return (
    <Card
      className="space-y-4"
      data-testid="container-run"
      data-status={run.status}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>{digits} digits of pi</CardTitle>
          <CardDescription>
            Run <code className="font-mono text-xs">{run.id.slice(0, 8)}</code>
            {run.startedBy ? ` · started by ${run.startedBy}` : ""}
          </CardDescription>
        </div>
        <ContainerRunStatusBadge status={run.status} />
      </div>

      <ContainerRunTimeline steps={run.steps} now={now} />

      {run.status === "failed" ? (
        <Callout
          tone="danger"
          title={
            ERROR_MESSAGES[run.errorCode ?? "internal"] ?? "The run failed"
          }
          description="The workflow stopped and marked the run failed. A retry starts a new run with the same digits."
          actions={
            <Button
              size="sm"
              icon={<RotateCcw />}
              disabled={retryDisabled}
              onClick={() => onRetry(run.id)}
            >
              Retry
            </Button>
          }
        />
      ) : null}

      {run.result ? (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-fg-muted">Run duration</dt>
              <dd
                className="font-mono tabular-nums text-fg"
                data-testid="run-duration"
              >
                {run.durationMs !== null
                  ? formatRunDuration(run.durationMs)
                  : "…"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">Compute in container</dt>
              <dd className="font-mono tabular-nums text-fg">
                {run.computeMs !== null
                  ? formatRunDuration(run.computeMs)
                  : "…"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">Result size</dt>
              <dd className="font-mono tabular-nums text-fg">
                {(run.result.bytes / 1024).toFixed(1)} KB
              </dd>
            </div>
          </dl>
          <div className="space-y-1">
            <p className="text-xs text-fg-muted">The first 100 digits</p>
            <p
              className="break-all rounded-md bg-surface p-3 font-mono text-xs leading-5 text-fg"
              data-testid="run-preview"
            >
              {run.result.preview}…
            </p>
          </div>
          <Button asChild size="sm" variant="secondary" icon={<Download />}>
            {/* A file from R2 through the Worker: a document load, not an SPA page. */}
            <a href={run.result.downloadHref} download>
              Download all {digits} digits
            </a>
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

/**
 * `/app/container-demo`: the container workflow demo
 * (docs/guides/how-to-run-container-workflows.md). Pick the digits, start a run, and
 * watch its Workflow: queued, starting the container, computing, storing in R2,
 * notifying, done, with timings, polled every second. Then the result (a preview, the
 * download, the duration) and the workspace's past runs with Retry on failed ones. When
 * the demo is off or a limit is reached, it says why instead of offering a run.
 */
export function ContainerDemoPage() {
  const { active } = useWorkspace();
  const navigate = useNavigate();
  const workspaceId = active?.id ?? "";
  const { run: requested } = useSearch({ strict: false }) as { run?: string };
  const [digits, setDigits] = useState("10000");
  const [starting, setStarting] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const runs = useAsync(
    () => trpc.containerRuns.list.query({ workspaceId }),
    `container-runs:${workspaceId}`
  );
  const selectedId = requested ?? runs.data?.items[0]?.id ?? null;
  const { run, error: runError } = useRun(workspaceId, selectedId);
  const availability = runs.data?.status.availability.state;
  const canStart = availability === "on";

  // When the run on show finishes, the list (and what is left today) catches up.
  const finished = run && !isActive(run) ? `${run.id}:${run.status}` : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: refetch when a run finishes
  useEffect(() => {
    if (finished) void runs.refetch();
  }, [finished]);

  function show(runId: string) {
    void navigate({ to: "/app/container-demo", search: { run: runId } });
  }

  async function start(input: { digits?: number; retryOf?: string }) {
    setStarting(true);
    setFailure(null);
    try {
      const started = await trpc.containerRuns.start.mutate({
        workspaceId,
        ...(input.retryOf
          ? { retryOf: input.retryOf }
          : { digits: input.digits as 1000 | 10000 | 50000 }),
      });
      show(started.runId);
      await runs.refetch();
    } catch (error) {
      setFailure(error);
      await runs.refetch();
    } finally {
      setStarting(false);
    }
  }

  const status = runs.data?.status;
  const unavailable =
    availability && availability !== "on" ? UNAVAILABLE[availability] : null;

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-text">
          Containers demo
        </p>
        <h2 className="text-3xl font-semibold text-fg">
          Containers: run a workflow
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-fg-muted">
          A Cloudflare Workflow runs each step in order and keeps its state: it
          starts a Cloudflare Container, computes digits of pi there, stores the
          result in R2, notifies you, and marks the run done. A step that fails
          is retried; the run fails only when its retries are used up.
        </p>
      </div>

      {unavailable ? (
        <Callout
          tone={availability === "off" ? "neutral" : "warning"}
          title={unavailable.title}
          description={unavailable.description}
          data-testid="container-demo-unavailable"
        />
      ) : null}

      <Card className="space-y-4">
        <div className="space-y-1">
          <CardTitle>Start a run</CardTitle>
          <CardDescription>
            {status
              ? `${Math.max(0, status.dailyCap - status.usedToday)} of ${status.dailyCap} runs left today for everyone · ${Math.max(0, status.hourlyLimit - status.usedThisHour)} of ${status.hourlyLimit} left for you this hour · results kept ${status.retentionDays} days`
              : "Pick how many digits of pi to compute."}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            aria-label="Digits of pi"
            value={digits}
            onValueChange={setDigits}
          >
            {(status?.presets ?? [1000, 10_000, 50_000]).map((preset) => (
              <SegmentedControlItem key={preset} value={String(preset)}>
                {preset.toLocaleString("en-US")}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
          <Button
            variant="primary"
            icon={<Play />}
            disabled={!canStart || starting}
            onClick={() => void start({ digits: Number(digits) })}
          >
            {starting ? "Starting…" : "Start run"}
          </Button>
        </div>
        {failure ? (
          <ErrorState
            variant="inline"
            error={failure}
            description={
              errorReference(failure) ? UNEXPECTED_ERROR_MESSAGE : undefined
            }
            reference={errorReference(failure)}
          />
        ) : null}
      </Card>

      {selectedId ? (
        run ? (
          <RunDetail
            run={run}
            onRetry={(id) => void start({ retryOf: id })}
            retryDisabled={!canStart || starting}
          />
        ) : runError ? (
          <ErrorState variant="inline" error={runError} />
        ) : (
          <Card className="space-y-3" aria-hidden>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-32 w-full" />
          </Card>
        )
      ) : null}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-fg">
          Past runs in this workspace
        </h3>
        <DataState
          status={runs.status}
          data={runs.data}
          error={runs.error}
          onRetry={runs.refetch}
          isEmpty={(data) => data.items.length === 0}
          loading={<ContainerRunListSkeleton />}
          empty={
            <EmptyState
              icon={<Boxes />}
              title="No runs yet"
              description="Pick how many digits of pi to compute and start a run. Runs and their results are kept for 7 days."
            />
          }
        >
          {(data) => (
            <ContainerRunList
              runs={data.items.map(toView)}
              selectedId={selectedId}
              onOpen={show}
              onRetry={(id) => void start({ retryOf: id })}
              retryDisabled={!canStart || starting}
            />
          )}
        </DataState>
      </div>
    </section>
  );
}
