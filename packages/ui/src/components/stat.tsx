import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { type HTMLAttributes, type ReactNode, type Ref, useId } from "react";

import { cn } from "../lib/utils";

export interface SparklineProps {
  readonly data: readonly number[];
  readonly width?: number;
  readonly height?: number;
  /** Fill the area under the line with a soft gradient. */
  readonly area?: boolean;
  /** Text colour class for the line, e.g. `text-success`. Defaults to the accent. */
  readonly className?: string;
  /** Accessible description, e.g. "Issues closed per day, last 14 days". Omit to hide it. */
  readonly label?: string;
}

/** A tiny inline line chart with no axes, for trends next to a number. */
export function Sparkline({
  data,
  width = 96,
  height = 28,
  area = true,
  className,
  label,
}: SparklineProps) {
  const gradientId = useId();
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = 2;
  const step = (width - pad * 2) / (data.length - 1);
  const points = data.map((value, index) => [
    pad + index * step,
    pad + (height - pad * 2) * (1 - (value - min) / span),
  ]);
  const line = points
    .map(
      ([x, y], index) =>
        `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`
    )
    .join(" ");
  const last = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0 overflow-visible text-accent", className)}
    >
      {area ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`${line} L${last[0].toFixed(1)} ${height} L${pad} ${height} Z`}
            fill={`url(#${gradientId})`}
          />
        </>
      ) : null}
      <path
        d={line}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2" fill="currentColor" />
    </svg>
  );
}

export interface StatProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  readonly label: ReactNode;
  /** The headline number, already formatted ("1,284", "92%", "3.4d"). */
  readonly value: ReactNode;
  /** Change versus the previous period, in percent (e.g. 12.5 or -4). */
  readonly delta?: number;
  /** What the delta compares to: "vs last week". */
  readonly deltaLabel?: ReactNode;
  /** Set when lower is better (cycle time, open bugs): a drop shows green. */
  readonly invertDelta?: boolean;
  /** Values for the trend line. */
  readonly sparkline?: readonly number[];
  /** Small icon next to the label. */
  readonly icon?: ReactNode;
  /** Render without the card border and padding (inside your own layout). */
  readonly bare?: boolean;
  readonly ref?: Ref<HTMLDivElement>;
}

/**
 * A metric card: label, big value, change versus the previous period coloured by
 * whether it is good, and an optional sparkline.
 */
export function Stat({
  label,
  value,
  delta,
  deltaLabel,
  invertDelta = false,
  sparkline,
  icon,
  bare = false,
  className,
  ...props
}: StatProps) {
  const direction =
    delta === undefined || delta === 0 ? "flat" : delta > 0 ? "up" : "down";
  const good =
    direction === "flat" ? null : (direction === "up") !== invertDelta;
  const tone =
    good === null ? "text-fg-muted" : good ? "text-success" : "text-danger";
  const DeltaIcon =
    direction === "up"
      ? ArrowUpRight
      : direction === "down"
        ? ArrowDownRight
        : Minus;

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        !bare &&
          "rounded-lg border border-line bg-surface-raised p-4 shadow-raised",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-fg-muted [&_svg]:size-3.5">
        {icon}
        {label}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-2xl font-semibold tracking-tight text-fg tabular-nums">
            {value}
          </span>
          {delta !== undefined ? (
            <span className="flex flex-wrap items-center gap-x-1 text-xs">
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-medium tabular-nums",
                  tone
                )}
              >
                <DeltaIcon aria-hidden className="size-3.5" />
                <span className="sr-only">
                  {direction === "up"
                    ? "Up"
                    : direction === "down"
                      ? "Down"
                      : "No change"}
                </span>
                {Math.abs(delta).toLocaleString("en-US", {
                  maximumFractionDigits: 1,
                })}
                %
              </span>
              {deltaLabel ? (
                <span className="whitespace-nowrap text-fg-subtle">
                  {deltaLabel}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
        {sparkline ? (
          <Sparkline
            data={sparkline}
            width={72}
            className={
              good === false
                ? "text-danger"
                : good
                  ? "text-success"
                  : "text-accent"
            }
          />
        ) : null}
      </div>
    </div>
  );
}
