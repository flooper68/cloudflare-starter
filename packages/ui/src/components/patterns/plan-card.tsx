import { CreditCard } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../lib/utils";
import { Badge, type Tone } from "../badge";
import { Card } from "../card";
import { Skeleton, SkeletonText } from "../skeleton";

/** A subscription's state as billing reports it; `null` is no subscription (default plan). */
export type PlanStatus = "trialing" | "active" | "past_due" | "canceled";

export interface PlanLimit {
  /** "Storage", "Seats". */
  readonly label: string;
  /** Formatted: "10 GB", "25", "Unlimited". */
  readonly value: string;
}

function statusBadge(
  status: PlanStatus | null,
  trialDaysLeft: number | null | undefined
): { readonly tone: Tone; readonly text: string } | null {
  switch (status) {
    case "trialing": {
      if (trialDaysLeft === null || trialDaysLeft === undefined)
        return { tone: "info", text: "Trial" };
      const days =
        trialDaysLeft <= 0
          ? "ends today"
          : `${trialDaysLeft} ${trialDaysLeft === 1 ? "day" : "days"} left`;
      return {
        tone: trialDaysLeft <= 7 ? "warning" : "info",
        text: `Trial · ${days}`,
      };
    }
    case "active":
      return { tone: "success", text: "Active" };
    case "past_due":
      return { tone: "danger", text: "Payment overdue" };
    case "canceled":
      return { tone: "neutral", text: "Canceled" };
    default:
      return null;
  }
}

export interface PlanCardProps {
  readonly planName: string;
  readonly status: PlanStatus | null;
  /** Whole days until a trial ends (0: today); shown on the trial badge. */
  readonly trialDaysLeft?: number | null;
  /** A line under the name: "Renews on 1 December", "Assigned by your admin". */
  readonly description?: ReactNode;
  /** The plan's key limits, in catalog order. */
  readonly limits?: readonly PlanLimit[];
  /** Features and add-ons the workspace has, as labels. */
  readonly includes?: readonly string[];
  /** Buttons: upgrade, manage billing. */
  readonly actions?: ReactNode;
  readonly className?: string;
}

/**
 * The workspace's plan: its name, its state (active, a trial with the days left, payment
 * overdue, canceled), its key limits, what it includes, and the billing actions.
 */
export function PlanCard({
  planName,
  status,
  trialDaysLeft,
  description,
  limits = [],
  includes = [],
  actions,
  className,
}: PlanCardProps) {
  const badge = statusBadge(status, trialDaysLeft);
  return (
    <Card className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs font-medium text-fg-muted">Current plan</p>
          <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight text-fg">
            <CreditCard aria-hidden className="size-4 text-fg-muted" />
            {planName}
            {badge ? (
              <Badge tone={badge.tone} variant="outline">
                {badge.text}
              </Badge>
            ) : null}
          </h3>
          {description ? (
            <p className="text-sm text-fg-muted">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {limits.length > 0 ? (
        <dl className="grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-3">
          {limits.map((limit) => (
            <div key={limit.label} className="flex flex-col gap-0.5">
              <dt className="text-xs text-fg-muted">{limit.label}</dt>
              <dd className="text-sm font-medium text-fg tabular-nums">
                {limit.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {includes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-fg-muted">Includes</span>
          {includes.map((item) => (
            <Badge key={item} tone="neutral">
              {item}
            </Badge>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

/** Loading placeholder shaped like a PlanCard. */
export function PlanCardSkeleton() {
  return (
    <Card
      role="status"
      aria-busy="true"
      aria-label="Loading plan"
      className="flex flex-col gap-4"
    >
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-6 w-40" />
      <SkeletonText lines={2} />
    </Card>
  );
}
