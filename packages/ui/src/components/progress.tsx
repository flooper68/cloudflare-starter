import { cva, type VariantProps } from "class-variance-authority";
import { Progress as ProgressPrimitive } from "radix-ui";
import { useEffect, useRef } from "react";

import { cn } from "../lib/utils";

const trackVariants = cva(
  "relative w-full overflow-hidden rounded-full bg-hover",
  {
    variants: {
      size: { sm: "h-1", md: "h-1.5", lg: "h-2" },
    },
    defaultVariants: { size: "md" },
  }
);

const toneFill = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
} as const;

export interface ProgressProps extends VariantProps<typeof trackVariants> {
  /** 0 to `max`; `null` (or omitted) shows an indeterminate bar. */
  readonly value?: number | null;
  readonly max?: number;
  readonly tone?: keyof typeof toneFill;
  /** Accessible name, e.g. "Uploading attachments". */
  readonly label?: string;
  readonly className?: string;
}

/** A thin progress bar. Without `value` it loops, for work of unknown length. */
export function Progress({
  value = null,
  max = 100,
  size,
  tone = "accent",
  label,
  className,
}: ProgressProps) {
  const indeterminate = value === null;
  const percent = indeterminate
    ? 0
    : Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <ProgressPrimitive.Root
      value={value}
      max={max}
      aria-label={label}
      className={cn(trackVariants({ size }), className)}
    >
      {indeterminate ? (
        <IndeterminateFill className={toneFill[tone]} />
      ) : (
        <ProgressPrimitive.Indicator
          className={cn(
            "h-full rounded-full transition-[width] duration-200 ease-out",
            toneFill[tone]
          )}
          style={{ width: `${percent}%` }}
        />
      )}
    </ProgressPrimitive.Root>
  );
}

// The theme has no sliding keyframes, so the loop runs on the Web Animations API.
function IndeterminateFill({ className }: { readonly className: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element?.animate) return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const animation = reduced
      ? element.animate([{ opacity: 0.4 }, { opacity: 1 }, { opacity: 0.4 }], {
          duration: 1600,
          iterations: Number.POSITIVE_INFINITY,
        })
      : element.animate(
          [
            { transform: "translateX(-100%)" },
            { transform: "translateX(250%)" },
          ],
          {
            duration: 1300,
            iterations: Number.POSITIVE_INFINITY,
            easing: "cubic-bezier(0.65, 0, 0.35, 1)",
          }
        );
    return () => animation.cancel();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("absolute inset-y-0 left-0 w-2/5 rounded-full", className)}
    />
  );
}

const ringSize = { sm: 14, md: 18, lg: 40 } as const;

export interface ProgressRingProps {
  /** 0 to 100. */
  readonly value: number;
  readonly size?: keyof typeof ringSize;
  readonly tone?: keyof typeof toneFill;
  /** Show the percentage: after the ring (sm, md) or inside it (lg). */
  readonly showValue?: boolean;
  /** Accessible name, e.g. "Q3 onboarding progress". */
  readonly label?: string;
  readonly className?: string;
}

const toneStroke = {
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
} as const;

/**
 * A small circular progress, like Linear's project progress next to a project name.
 * Turns green at 100% unless a tone is set.
 */
export function ProgressRing({
  value,
  size = "md",
  tone,
  showValue = false,
  label,
  className,
}: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const px = ringSize[size];
  const stroke = size === "lg" ? 3.5 : 2;
  const radius = (px - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const resolvedTone = tone ?? (clamped >= 100 ? "success" : "accent");
  const percent = `${Math.round(clamped)}%`;

  return (
    <span
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
      className={cn(
        "relative inline-flex shrink-0 items-center gap-1.5 align-middle",
        className
      )}
    >
      <svg
        width={px}
        height={px}
        viewBox={`0 0 ${px} ${px}`}
        className={cn("-rotate-90", toneStroke[resolvedTone])}
        aria-hidden
      >
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={stroke}
        />
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className="transition-[stroke-dashoffset] duration-200 ease-out"
        />
      </svg>
      {showValue && size === "lg" ? (
        <span className="absolute inset-0 flex items-center justify-center text-2xs font-medium text-fg tabular-nums">
          {percent}
        </span>
      ) : null}
      {showValue && size !== "lg" ? (
        <span className="text-xs text-fg-muted tabular-nums">{percent}</span>
      ) : null}
    </span>
  );
}
