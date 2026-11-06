import { HeartPulse, RefreshCw } from "lucide-react";

import { Badge, type Tone } from "../badge";
import { Button } from "../button";
import { Card } from "../card";
import { Skeleton } from "../skeleton";

export type AdminHealthStatus = "pass" | "warn" | "fail";

/** One entry of the `checks` map (IETF health check response format). */
export interface AdminHealthCheck {
  readonly componentType: string;
  readonly status: AdminHealthStatus;
  readonly time: string;
  readonly observedValue?: number;
  readonly observedUnit?: string;
  readonly output?: string;
}

/** A readiness report in the IETF health check response format (`application/health+json`). */
export interface AdminHealthData {
  readonly status: AdminHealthStatus;
  readonly releaseId: string;
  readonly output?: string;
  readonly checks: Readonly<Record<string, readonly AdminHealthCheck[]>>;
  /** The trace id of the check: its logs are one search away. */
  readonly reference: string;
}

export interface AdminHealthProps {
  readonly health: AdminHealthData;
  /** Runs the checks again; hides the button when absent. */
  readonly onRefresh?: () => void;
  readonly refreshing?: boolean;
}

const STATUS: Record<
  AdminHealthStatus,
  { readonly label: string; readonly tone: Tone }
> = {
  pass: { label: "Pass", tone: "success" },
  warn: { label: "Warn", tone: "warning" },
  fail: { label: "Fail", tone: "danger" },
};

const clock = new Intl.DateTimeFormat("en", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

/** When the checks finished: the latest `time` of any check. */
function checkedAt(health: AdminHealthData): Date | null {
  const times = Object.values(health.checks)
    .flat()
    .map((entry) => Date.parse(entry.time))
    .filter((time) => !Number.isNaN(time));
  return times.length > 0 ? new Date(Math.max(...times)) : null;
}

function StatusBadge({ status }: { readonly status: AdminHealthStatus }) {
  return <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>;
}

/**
 * The deployment's readiness, checked live when the page opens: the overall status, when
 * it was checked, the release, and each dependency check with its status, latency and, when it did not pass,
 * what went wrong. The same checks as the public `/health/ready`, with the detail the
 * public body leaves out.
 */
export function AdminHealth({
  health,
  onRefresh,
  refreshing = false,
}: AdminHealthProps) {
  const checked = checkedAt(health);
  const checks = Object.entries(health.checks).flatMap(([name, entries]) =>
    entries.map((entry, index) => ({ key: `${name}:${index}`, name, entry }))
  );
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex items-center gap-2 text-sm font-medium text-fg">
            <HeartPulse aria-hidden className="size-4 text-fg-muted" />
            Health
          </p>
          <StatusBadge status={health.status} />
          {health.output ? (
            <span className="text-xs text-fg-muted">{health.output}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {checked ? (
            <span className="text-xs text-fg-muted">
              Checked{" "}
              <time dateTime={checked.toISOString()}>
                {clock.format(checked)} UTC
              </time>
            </span>
          ) : null}
          {onRefresh ? (
            <Button
              size="sm"
              variant="secondary"
              icon={<RefreshCw />}
              loading={refreshing}
              onClick={onRefresh}
            >
              Check again
            </Button>
          ) : null}
        </div>
      </div>
      <ul className="flex flex-col divide-y divide-line text-sm">
        {checks.map(({ key, name, entry }) => (
          <li
            key={key}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5"
          >
            <span className="flex min-w-0 flex-col">
              <code className="text-xs text-fg">{name}</code>
              {entry.output ? (
                <span className="break-words text-xs text-fg-muted">
                  {entry.output}
                </span>
              ) : null}
            </span>
            <span className="flex items-center gap-3">
              {entry.observedValue === undefined ? null : (
                <span className="tabular-nums text-xs text-fg-muted">
                  {entry.observedValue} {entry.observedUnit ?? ""}
                </span>
              )}
              <StatusBadge status={entry.status} />
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-fg-muted">
        Release <code className="text-fg">{health.releaseId}</code> · reference{" "}
        <code className="text-fg">{health.reference}</code>
      </p>
    </Card>
  );
}

/** Loading placeholder shaped like the health card. */
export function AdminHealthSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading health">
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}
