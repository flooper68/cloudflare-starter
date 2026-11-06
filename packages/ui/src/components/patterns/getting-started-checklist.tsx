import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../card";
import { Progress } from "../progress";
import { Skeleton } from "../skeleton";

export interface ChecklistStep {
  readonly id: string;
  readonly title: string;
  /** Why it matters or what it does, in one line. */
  readonly description: string;
  readonly done: boolean;
  /** The way to do it (a small Button as a link); hidden once the step is done. */
  readonly action?: ReactNode;
}

export interface GettingStartedChecklistProps {
  readonly steps: readonly ChecklistStep[];
  readonly title?: string;
  readonly description?: ReactNode;
  readonly className?: string;
}

/**
 * The dashboard's first card: a few steps that set up an account and a workspace (verify
 * the email, invite someone, turn on two-factor, create something), each with its own
 * action and a check once done, and how many are done.
 */
export function GettingStartedChecklist({
  steps,
  title = "Get started",
  description,
  className,
}: GettingStartedChecklistProps) {
  const done = steps.filter((step) => step.done).length;
  return (
    <Card className={cn("space-y-4", className)}>
      <CardHeader>
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          <span className="text-xs text-fg-muted">
            {done} of {steps.length} done
          </span>
        </div>
        {description ? (
          <p className="text-sm text-fg-muted">{description}</p>
        ) : null}
        <Progress
          value={done}
          max={Math.max(steps.length, 1)}
          tone={done === steps.length ? "success" : "accent"}
          label={`${done} of ${steps.length} steps done`}
          className="mt-2"
        />
      </CardHeader>
      <CardContent>
        <ol className="divide-y divide-line" aria-label={title}>
          {steps.map((step) => (
            <li key={step.id} className="flex items-start gap-3 py-3">
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border [&_svg]:size-3",
                  step.done
                    ? "border-transparent bg-success-solid text-on-solid"
                    : "border-line-strong text-transparent"
                )}
                aria-hidden="true"
              >
                <Check />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.done ? "text-fg-muted line-through" : "text-fg"
                  )}
                >
                  {step.title}
                  <span className="sr-only">
                    {step.done ? " (done)" : " (to do)"}
                  </span>
                </p>
                <p className="text-xs text-fg-muted">{step.description}</p>
              </div>
              {!step.done && step.action ? (
                <div className="shrink-0">{step.action}</div>
              ) : null}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

/** The checklist while the steps' state loads: shaped like its rows. */
export function GettingStartedChecklistSkeleton({
  rows = 4,
}: {
  readonly rows?: number;
}) {
  return (
    <Card className="space-y-4" aria-hidden>
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-1.5 w-full" />
      <div className="space-y-4">
        {Array.from({ length: rows }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-5 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
