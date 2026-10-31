import type { ReactNode } from "react";

import { cn } from "../lib/utils";
import { Badge } from "./badge";
import { Progress } from "./progress";
import { Skeleton } from "./skeleton";

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** `1536` → `1.5 KB` (binary multiples, at most one decimal). */
export function formatBytes(bytes: number): string {
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded =
    unit === 0 || value >= 100
      ? Math.round(value)
      : Math.round(value * 10) / 10;
  return `${rounded} ${BYTE_UNITS[unit]}`;
}

/** Where a meter stands against its limit. */
export type UsageLevel = "unlimited" | "ok" | "near" | "full" | "over";

/**
 * `near` from `nearAt` (a fraction of the limit) up, `full` at the limit, `over` past it.
 * A limit of 0 is `full` while nothing is used.
 */
export function usageLevel(
  used: number,
  limit: number | null,
  nearAt = 0.8
): UsageLevel {
  if (limit === null) return "unlimited";
  if (used > limit) return "over";
  if (used === limit) return "full";
  return used >= limit * nearAt ? "near" : "ok";
}

const levelTone = {
  ok: "accent",
  near: "warning",
  full: "danger",
  over: "danger",
} as const;

const levelBadge: Partial<Record<UsageLevel, ReactNode>> = {
  near: (
    <Badge tone="warning" variant="outline">
      Near limit
    </Badge>
  ),
  full: (
    <Badge tone="danger" variant="outline">
      Limit reached
    </Badge>
  ),
  over: (
    <Badge tone="danger" variant="outline">
      Over limit
    </Badge>
  ),
  unlimited: <Badge tone="neutral">Unlimited</Badge>,
};

export interface UsageMeterProps {
  /** What is measured: "Storage", "Seats". */
  readonly label: string;
  readonly used: number;
  /** `null` is unlimited: no bar, an "Unlimited" badge. */
  readonly limit: number | null;
  /** `bytes` formats as KB/MB/GB; `count` as a plain number. */
  readonly unit?: "bytes" | "count";
  /** Overrides the unit's formatting. */
  readonly format?: (value: number) => string;
  /** Fraction of the limit from which the meter warns; default 0.8. */
  readonly nearAt?: number;
  /** A line under the bar: "Resets on 1 December", "Raised by an admin". */
  readonly description?: ReactNode;
  /** Extra badges after the state badge ("Override"). */
  readonly badges?: ReactNode;
  readonly className?: string;
}

/**
 * How much of a plan's limit a workspace uses: label, "used of limit", a bar that turns
 * amber near the limit and red at or past it, and a badge naming the state. Unlimited
 * metrics show the amount used and an "Unlimited" badge instead of a bar.
 */
export function UsageMeter({
  label,
  used,
  limit,
  unit = "count",
  format,
  nearAt = 0.8,
  description,
  badges,
  className,
}: UsageMeterProps) {
  const show =
    format ??
    (unit === "bytes"
      ? formatBytes
      : (value: number) => value.toLocaleString("en-US"));
  const level = usageLevel(used, limit, nearAt);
  // Radix Progress refuses values above max: the bar is a percentage, capped at 100.
  const percent =
    limit === null
      ? 0
      : limit === 0
        ? 100
        : Math.min(100, Math.round((used / limit) * 100));

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex items-center gap-2 text-sm font-medium text-fg">
          {label}
          {levelBadge[level]}
          {badges}
        </span>
        <span className="text-sm text-fg-muted tabular-nums">
          {limit === null
            ? `${show(used)} used`
            : `${show(used)} of ${show(limit)}`}
        </span>
      </div>
      {level === "unlimited" ? null : (
        <Progress
          value={percent}
          max={100}
          tone={levelTone[level]}
          label={`${label} used`}
        />
      )}
      {description ? (
        <p className="text-xs text-fg-muted">{description}</p>
      ) : null}
    </div>
  );
}

/** Loading placeholder for a list of meters. */
export function UsageMeterSkeleton({ count = 3 }: { readonly count?: number }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading usage"
      className="flex flex-col gap-5"
    >
      {Array.from({ length: count }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
        <div key={index} className="flex flex-col gap-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}
