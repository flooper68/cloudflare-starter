import type { IssuePriority, IssueStatus } from "../issue-icons";

export type { IssuePriority, IssueStatus };

/** Label colours map to the semantic tokens, never to raw colours. */
export type IssueLabelColor =
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

export interface IssueLabel {
  readonly id: string;
  readonly name: string;
  readonly color: IssueLabelColor;
}

export interface IssuePerson {
  readonly id: string;
  readonly name: string;
  /** Optional picture; initials are shown without it. */
  readonly avatarUrl?: string;
}

export interface Issue {
  readonly id: string;
  /** Team key and number, e.g. "ENG-123". */
  readonly identifier: string;
  readonly title: string;
  readonly status: IssueStatus;
  readonly priority: IssuePriority;
  readonly labels?: readonly IssueLabel[];
  readonly assignee?: IssuePerson | null;
  /** ISO date (yyyy-mm-dd). */
  readonly dueDate?: string | null;
}

export interface IssueStatusMeta {
  readonly value: IssueStatus;
  readonly label: string;
}

export const ISSUE_STATUSES: readonly IssueStatusMeta[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In Progress" },
  { value: "in_review", label: "In Review" },
  { value: "done", label: "Done" },
  { value: "canceled", label: "Canceled" },
];

export interface IssuePriorityMeta {
  readonly value: IssuePriority;
  readonly label: string;
}

/** Picker order, Linear-style: "No priority" first, then urgent to low. */
export const ISSUE_PRIORITIES: readonly IssuePriorityMeta[] = [
  { value: "none", label: "No priority" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function statusLabel(status: IssueStatus): string {
  return ISSUE_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function priorityLabel(priority: IssuePriority): string {
  return ISSUE_PRIORITIES.find((p) => p.value === priority)?.label ?? priority;
}

// The glyphs are the shared data-display components.
export { PriorityIcon, StatusIcon } from "../issue-icons";
