import {
  CircleDashed,
  CircleUserRound,
  Columns3,
  List,
  SignalHigh,
} from "lucide-react";
import { useMemo, useState } from "react";

import { ViewSwitch } from "./app-shell";
import {
  type Filter,
  FilterBar,
  type FilterProperty,
  matchesFilters,
} from "./filter-bar";
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  type Issue,
  type IssuePerson,
  type IssueStatus,
  PriorityIcon,
  StatusIcon,
  statusLabel,
} from "./issue-glyphs";
import { IssueList, type IssuePatch } from "./issue-list";
import { KanbanBoard, type KanbanColumn, moveKanbanItem } from "./kanban-board";

const BOARD_STATUSES: readonly IssueStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "done",
];

export interface TaskBoardProps {
  /** The tasks to start from; changes stay in the component (nothing is saved). */
  readonly tasks: readonly Issue[];
  /** People the assignee filter offers. */
  readonly people: readonly IssuePerson[];
  readonly defaultView?: "list" | "board";
}

function taskProperty(task: Issue, property: string) {
  if (property === "status") return task.status;
  if (property === "priority") return task.priority;
  if (property === "assignee") return task.assignee?.id ?? "none";
  return null;
}

/**
 * The placeholder Tasks app: tasks as a list or a board (one view switched by
 * ViewSwitch, not tabs), filtered by status, priority and assignee. State lives in the
 * component, so it demonstrates IssueList, KanbanBoard and FilterBar without a backend.
 */
export function TaskBoard({
  tasks: initial,
  people,
  defaultView = "board",
}: TaskBoardProps) {
  const [tasks, setTasks] = useState<readonly Issue[]>(initial);
  const [view, setView] = useState<string>(defaultView);
  const [filters, setFilters] = useState<readonly Filter[]>([]);

  const properties: FilterProperty[] = useMemo(
    () => [
      {
        id: "status",
        label: "Status",
        pluralLabel: "statuses",
        icon: <CircleDashed />,
        options: ISSUE_STATUSES.map((status) => ({
          value: status.value,
          label: status.label,
          icon: <StatusIcon status={status.value} />,
        })),
      },
      {
        id: "priority",
        label: "Priority",
        pluralLabel: "priorities",
        icon: <SignalHigh />,
        options: ISSUE_PRIORITIES.map((priority) => ({
          value: priority.value,
          label: priority.label,
          icon: <PriorityIcon priority={priority.value} />,
        })),
      },
      {
        id: "assignee",
        label: "Assignee",
        icon: <CircleUserRound />,
        options: [
          { value: "none", label: "No assignee" },
          ...people.map((person) => ({ value: person.id, label: person.name })),
        ],
      },
    ],
    [people]
  );

  const shown = useMemo(
    () => tasks.filter((task) => matchesFilters(task, filters, taskProperty)),
    [tasks, filters]
  );
  const columns: KanbanColumn[] = BOARD_STATUSES.map((status) => ({
    id: status,
    status,
    title: statusLabel(status),
    items: shown.filter((task) => task.status === status),
  }));
  const patch = (id: string, change: IssuePatch) =>
    setTasks((all) =>
      all.map((task) => (task.id === id ? { ...task, ...change } : task))
    );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <ViewSwitch
          value={view}
          onValueChange={setView}
          showLabels
          options={[
            { value: "list", label: "List", icon: <List /> },
            { value: "board", label: "Board", icon: <Columns3 /> },
          ]}
        />
        <span className="text-xs tabular-nums text-fg-muted">
          {shown.length} of {tasks.length} tasks
        </span>
      </div>
      <FilterBar
        properties={properties}
        value={filters}
        onValueChange={setFilters}
        className="rounded-lg border border-line"
      />
      <div className="min-w-0 overflow-x-auto rounded-lg border border-line bg-surface">
        {view === "list" ? (
          <IssueList aria-label="Tasks" issues={shown} onIssueChange={patch} />
        ) : (
          <KanbanBoard
            columns={columns}
            onIssueChange={patch}
            onMove={(move) => {
              const next = moveKanbanItem(columns, move);
              const ordered = next.flatMap((column) =>
                column.items.map((task) => ({
                  ...task,
                  status: column.status ?? task.status,
                }))
              );
              const ids = new Set(ordered.map((task) => task.id));
              setTasks([
                ...ordered,
                ...tasks.filter((task) => !ids.has(task.id)),
              ]);
            }}
          />
        )}
      </div>
    </div>
  );
}
