import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Columns3,
  List,
  ListFilter,
  SlidersHorizontal,
  Star,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button, IconButton } from "../button";
import { Tooltip } from "../tooltip";
import {
  AppBreadcrumb,
  AppShell,
  AppTopBar,
  TeamIcon,
  ViewSwitch,
} from "./app-shell";
import { type Filter, FilterBar, matchesFilters } from "./filter-bar";
import {
  DemoSidebar,
  filterProperties,
  issues as fixtureIssues,
  issueProperty,
} from "./fixtures";
import { type Issue, type IssueStatus, statusLabel } from "./issue-glyphs";
import { IssueList, type IssuePatch } from "./issue-list";
import { KanbanBoard, type KanbanColumn, moveKanbanItem } from "./kanban-board";

/**
 * The patterns together as an app: AppShell with the sidebar, a FilterBar, and the team's
 * issues as a list or a board. Everything is live: change status or priority from the
 * glyphs, filter, drag cards across columns (the status follows), press `[` to collapse the
 * sidebar.
 */
const meta = {
  title: "Patterns/Examples/Issue tracker",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const boardStatuses: readonly IssueStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
];

function IssueTracker({
  initialView = "list",
}: {
  readonly initialView?: "list" | "board";
}) {
  const [issues, setIssues] = useState<readonly Issue[]>(fixtureIssues);
  const [view, setView] = useState<string>(initialView);
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState<readonly Filter[]>([
    {
      id: "f-status",
      property: "status",
      operator: "is_not",
      values: ["canceled"],
    },
  ]);
  const [selected, setSelected] = useState<readonly string[]>([]);

  const shown = useMemo(
    () => issues.filter((i) => matchesFilters(i, filters, issueProperty)),
    [issues, filters]
  );

  const columns: KanbanColumn[] = boardStatuses.map((status) => ({
    id: status,
    status,
    title: statusLabel(status),
    items: shown.filter((i) => i.status === status),
  }));

  const patch = (id: string, change: IssuePatch) =>
    setIssues((all) => all.map((i) => (i.id === id ? { ...i, ...change } : i)));

  return (
    <AppShell sidebar={<DemoSidebar />}>
      <AppTopBar
        title={
          <div className="flex min-w-0 items-center gap-1">
            <AppBreadcrumb
              items={[
                <>
                  <TeamIcon name="Engineering" />
                  Engineering
                </>,
                "Active issues",
              ]}
            />
            <Tooltip content="Add to favourites">
              <IconButton label="Add to favourites" size="xs">
                <Star />
              </IconButton>
            </Tooltip>
          </div>
        }
        actions={
          <>
            <ViewSwitch
              value={view}
              onValueChange={setView}
              options={[
                { value: "list", label: "List", icon: <List /> },
                { value: "board", label: "Board", icon: <Columns3 /> },
              ]}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<ListFilter />}
              aria-pressed={showFilters}
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? "bg-active text-fg" : undefined}
            >
              <span className="hidden sm:inline">Filter</span>
            </Button>
            <Button variant="secondary" size="sm" icon={<SlidersHorizontal />}>
              <span className="hidden sm:inline">Display</span>
            </Button>
          </>
        }
      />
      {showFilters ? (
        <FilterBar
          properties={filterProperties}
          value={filters}
          onValueChange={setFilters}
          actions={
            selected.length > 0 ? (
              <span className="text-xs text-fg-muted">
                {selected.length} selected
              </span>
            ) : (
              <span className="text-xs text-fg-subtle tabular-nums">
                {shown.length} of {issues.length}
              </span>
            )
          }
        />
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto">
        {view === "list" ? (
          <IssueList
            issues={shown}
            selectedIds={selected}
            onSelectedIdsChange={setSelected}
            onIssueChange={patch}
            onAddIssue={() => {}}
          />
        ) : (
          <KanbanBoard
            columns={columns}
            onIssueChange={patch}
            onAddIssue={() => {}}
            onMove={(move) => {
              // Apply to the visible columns, then rebuild the issue order and statuses.
              const next = moveKanbanItem(columns, move);
              const ordered = next.flatMap((c) =>
                c.items.map((i) => ({ ...i, status: c.status ?? i.status }))
              );
              const ids = new Set(ordered.map((i) => i.id));
              setIssues([...ordered, ...issues.filter((i) => !ids.has(i.id))]);
            }}
          />
        )}
      </div>
    </AppShell>
  );
}

export const ListView: Story = {
  name: "List",
  render: () => <IssueTracker />,
};

export const BoardView: Story = {
  name: "Board",
  render: () => <IssueTracker initialView="board" />,
};
