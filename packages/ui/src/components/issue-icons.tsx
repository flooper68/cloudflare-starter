import { type SVGAttributes, useId } from "react";

import { cn } from "../lib/utils";

/** Workflow states of an issue, in board order. */
export const issueStatuses = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "canceled",
] as const;
export type IssueStatus = (typeof issueStatuses)[number];

export const issueStatusLabel: Record<IssueStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
  canceled: "Canceled",
};

/** Issue priorities, most important first ("none" sorts last). */
export const issuePriorities = [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
] as const;
export type IssuePriority = (typeof issuePriorities)[number];

export const issuePriorityLabel: Record<IssuePriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "No priority",
};

const statusColour: Record<IssueStatus, string> = {
  backlog: "text-fg-subtle",
  todo: "text-fg-muted",
  in_progress: "text-warning",
  in_review: "text-success",
  done: "text-accent",
  canceled: "text-fg-subtle",
};

type IconProps = Omit<SVGAttributes<SVGSVGElement>, "children">;

export interface StatusIconProps extends IconProps {
  readonly status: IssueStatus;
  /** Accessible name; defaults to the status label. Pass "" when text next to it says it. */
  readonly label?: string;
}

/** Linear-style workflow state glyph: dotted, empty, half, three-quarter, done or canceled circle. */
export function StatusIcon({
  status,
  label,
  className,
  ...props
}: StatusIconProps) {
  const maskId = useId();
  const name = label ?? issueStatusLabel[status];

  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      role={name ? "img" : undefined}
      aria-label={name || undefined}
      aria-hidden={name ? undefined : true}
      className={cn("size-3.5 shrink-0", statusColour[status], className)}
      {...props}
    >
      {status === "backlog" ? (
        <circle
          cx="7"
          cy="7"
          r="6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="1.4 1.74"
          strokeDashoffset="0.65"
        />
      ) : null}
      {status === "todo" ||
      status === "in_progress" ||
      status === "in_review" ? (
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
      ) : null}
      {status === "in_progress" ? (
        <path d="M7 3.5a3.5 3.5 0 0 1 0 7z" fill="currentColor" />
      ) : null}
      {status === "in_review" ? (
        <path d="M7 3.5a3.5 3.5 0 1 1-3.5 3.5H7z" fill="currentColor" />
      ) : null}
      {status === "done" || status === "canceled" ? (
        <>
          <mask id={maskId}>
            <rect width="14" height="14" fill="white" />
            {status === "done" ? (
              <path
                d="M4.5 7.2 6.2 8.9 9.6 5.3"
                stroke="black"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <path
                d="M5 5l4 4M9 5l-4 4"
                stroke="black"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            )}
          </mask>
          <circle
            cx="7"
            cy="7"
            r="7"
            fill="currentColor"
            mask={`url(#${maskId})`}
          />
        </>
      ) : null}
    </svg>
  );
}

const filledBars: Record<Exclude<IssuePriority, "urgent" | "none">, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export interface PriorityIconProps extends IconProps {
  readonly priority: IssuePriority;
  /** Accessible name; defaults to the priority label. Pass "" when text next to it says it. */
  readonly label?: string;
}

/** Linear-style priority glyph: three bars (filled by importance), "!" square for urgent, dashes for none. */
export function PriorityIcon({
  priority,
  label,
  className,
  ...props
}: PriorityIconProps) {
  const maskId = useId();
  const name = label ?? issuePriorityLabel[priority];

  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      role={name ? "img" : undefined}
      aria-label={name || undefined}
      aria-hidden={name ? undefined : true}
      className={cn(
        "size-4 shrink-0",
        priority === "urgent" ? "text-warning" : "text-fg-muted",
        className
      )}
      {...props}
    >
      {priority === "none" ? (
        <>
          <rect
            x="1.5"
            y="7.25"
            width="3"
            height="1.5"
            rx="0.5"
            opacity="0.9"
          />
          <rect
            x="6.5"
            y="7.25"
            width="3"
            height="1.5"
            rx="0.5"
            opacity="0.9"
          />
          <rect
            x="11.5"
            y="7.25"
            width="3"
            height="1.5"
            rx="0.5"
            opacity="0.9"
          />
        </>
      ) : null}
      {priority === "urgent" ? (
        <>
          <mask id={maskId}>
            <rect width="16" height="16" fill="white" />
            <rect
              x="7.1"
              y="3.5"
              width="1.8"
              height="5.5"
              rx="0.6"
              fill="black"
            />
            <rect
              x="7.1"
              y="10.4"
              width="1.8"
              height="1.8"
              rx="0.6"
              fill="black"
            />
          </mask>
          <rect
            x="1"
            y="1"
            width="14"
            height="14"
            rx="3"
            mask={`url(#${maskId})`}
          />
        </>
      ) : null}
      {priority === "high" || priority === "medium" || priority === "low" ? (
        <>
          <rect
            x="1.5"
            y="8"
            width="3"
            height="6"
            rx="1"
            opacity={filledBars[priority] >= 1 ? 1 : 0.3}
          />
          <rect
            x="6.5"
            y="5"
            width="3"
            height="9"
            rx="1"
            opacity={filledBars[priority] >= 2 ? 1 : 0.3}
          />
          <rect
            x="11.5"
            y="2"
            width="3"
            height="12"
            rx="1"
            opacity={filledBars[priority] >= 3 ? 1 : 0.3}
          />
        </>
      ) : null}
    </svg>
  );
}
