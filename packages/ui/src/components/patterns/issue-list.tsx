import { ChevronRight, Plus } from "lucide-react";
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "../../lib/utils";
import { IconButton } from "../button";
import { Checkbox } from "../checkbox";
import { Tooltip } from "../tooltip";
import {
  formatShortDate,
  isOverdue,
  isTypingTarget,
  LabelChip,
  PersonAvatar,
  useControllable,
} from "./internal";
import {
  ISSUE_STATUSES,
  type Issue,
  type IssueStatus,
  PriorityIcon,
  priorityLabel,
  StatusIcon,
  statusLabel,
} from "./issue-glyphs";
import { GlyphButton, PriorityPicker, StatusPicker } from "./issue-pickers";

export type IssuePatch = Partial<Omit<Issue, "id" | "identifier">>;

export interface IssueRowProps {
  readonly issue: Issue;
  readonly selected?: boolean;
  /** Keyboard cursor; shown like hover. */
  readonly active?: boolean;
  /** Any row is selected: checkboxes stay visible. */
  readonly selectionMode?: boolean;
  readonly onSelectedChange?: (selected: boolean) => void;
  readonly onIssueChange?: (patch: IssuePatch) => void;
  readonly onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  readonly id?: string;
  readonly className?: string;
}

/**
 * One dense issue row: checkbox (on hover or in selection mode), priority, identifier, status,
 * title, labels, due date and assignee. Priority and status glyphs open their pickers.
 */
export function IssueRow({
  issue,
  selected = false,
  active = false,
  selectionMode = false,
  onSelectedChange,
  onIssueChange,
  onClick,
  id,
  className,
}: IssueRowProps) {
  const overdue =
    issue.dueDate && issue.status !== "done" && issue.status !== "canceled"
      ? isOverdue(issue.dueDate)
      : false;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the IssueList handles the keyboard.
    <div
      id={id}
      role="option"
      tabIndex={-1}
      aria-selected={selected}
      data-active={active || undefined}
      data-selected={selected || undefined}
      onClick={onClick}
      className={cn(
        "group/row relative flex h-9 cursor-default select-none items-center gap-2 border-b border-line/60 pr-4 pl-2 text-sm",
        "hover:bg-hover data-[active]:bg-hover",
        "data-[selected]:bg-accent-subtle data-[selected]:hover:bg-accent-subtle",
        className
      )}
    >
      <span
        className={cn(
          "flex w-5 shrink-0 justify-center opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100",
          (selected || selectionMode) && "opacity-100"
        )}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelectedChange?.(checked === true)}
          aria-label={`Select ${issue.identifier}`}
          tabIndex={-1}
        />
      </span>

      <PriorityPicker
        value={issue.priority}
        onValueChange={(priority) => onIssueChange?.({ priority })}
      >
        <GlyphButton label={`Priority: ${priorityLabel(issue.priority)}`}>
          <PriorityIcon priority={issue.priority} />
        </GlyphButton>
      </PriorityPicker>

      <span className="w-16 shrink-0 truncate text-xs tabular-nums text-fg-subtle">
        {issue.identifier}
      </span>

      <StatusPicker
        value={issue.status}
        onValueChange={(status) => onIssueChange?.({ status })}
      >
        <GlyphButton label={`Status: ${statusLabel(issue.status)}`}>
          <StatusIcon status={issue.status} />
        </GlyphButton>
      </StatusPicker>

      <span className="min-w-0 flex-1 truncate font-medium text-fg">
        {issue.title}
      </span>

      {issue.labels && issue.labels.length > 0 ? (
        <span className="hidden min-w-0 items-center gap-1 md:flex">
          {issue.labels.slice(0, 3).map((label) => (
            <LabelChip key={label.id} label={label} />
          ))}
          {issue.labels.length > 3 ? (
            <span className="text-2xs text-fg-subtle">
              +{issue.labels.length - 3}
            </span>
          ) : null}
        </span>
      ) : null}

      {issue.dueDate ? (
        <span
          className={cn(
            "hidden w-14 shrink-0 text-right text-xs tabular-nums sm:inline",
            overdue ? "text-danger" : "text-fg-subtle"
          )}
        >
          {formatShortDate(issue.dueDate)}
        </span>
      ) : (
        <span className="hidden w-14 shrink-0 sm:inline" />
      )}

      <Tooltip content={issue.assignee ? issue.assignee.name : "Unassigned"}>
        <span className="inline-flex">
          <PersonAvatar person={issue.assignee} size="sm" />
        </span>
      </Tooltip>
    </div>
  );
}

export interface IssueGroupHeaderProps {
  readonly status: IssueStatus;
  readonly count: number;
  readonly collapsed?: boolean;
  readonly onCollapsedChange?: (collapsed: boolean) => void;
  readonly onAdd?: () => void;
  /** Overrides the status name. */
  readonly title?: ReactNode;
}

/** Sticky group header: status glyph, name, count and a "+" to add an issue in that status. */
export function IssueGroupHeader({
  status,
  count,
  collapsed = false,
  onCollapsedChange,
  onAdd,
  title,
}: IssueGroupHeaderProps) {
  return (
    <div className="sticky top-0 z-10 flex h-9 items-center gap-2 border-b border-line bg-surface-raised pr-2 pl-2 text-sm">
      <button
        type="button"
        aria-expanded={!collapsed}
        onClick={() => onCollapsedChange?.(!collapsed)}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            "size-3.5 text-fg-subtle transition-transform duration-100",
            !collapsed && "rotate-90"
          )}
        />
        <StatusIcon status={status} />
        <span className="font-medium text-fg">
          {title ?? statusLabel(status)}
        </span>
        <span className="text-fg-subtle tabular-nums">{count}</span>
      </button>
      {onAdd ? (
        <IconButton
          label={`New issue in ${statusLabel(status)}`}
          size="xs"
          onClick={onAdd}
        >
          <Plus />
        </IconButton>
      ) : null}
    </div>
  );
}

export interface IssueListProps {
  readonly issues: readonly Issue[];
  /** Status order of the groups; defaults to Linear's (backlog first). */
  readonly statuses?: readonly IssueStatus[];
  /** Show groups that have no issues. */
  readonly showEmptyGroups?: boolean;
  readonly selectedIds?: readonly string[];
  readonly defaultSelectedIds?: readonly string[];
  readonly onSelectedIdsChange?: (ids: readonly string[]) => void;
  /** Called when a picker in a row changes the issue. */
  readonly onIssueChange?: (id: string, patch: IssuePatch) => void;
  /** Click or Enter on a row. */
  readonly onIssueOpen?: (issue: Issue) => void;
  /** "+" in a group header. */
  readonly onAddIssue?: (status: IssueStatus) => void;
  /** Shown when there are no issues at all. */
  readonly empty?: ReactNode;
  readonly className?: string;
  readonly "aria-label"?: string;
}

const defaultStatusOrder: readonly IssueStatus[] = [
  "in_review",
  "in_progress",
  "todo",
  "backlog",
  "done",
  "canceled",
];

/**
 * Linear's issue list: grouped by status with sticky headers, dense rows, multi-select.
 * Keyboard (when the list has focus): ↑/↓ or j/k move, x toggles selection, Shift+↑/↓ extends
 * it, Enter opens, Escape clears the selection. ⌘/Ctrl-click toggles, Shift-click selects a range.
 */
export function IssueList({
  issues,
  statuses = defaultStatusOrder,
  showEmptyGroups = false,
  selectedIds,
  defaultSelectedIds = [],
  onSelectedIdsChange,
  onIssueChange,
  onIssueOpen,
  onAddIssue,
  empty,
  className,
  "aria-label": ariaLabel = "Issues",
}: IssueListProps) {
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useControllable<readonly string[]>(
    selectedIds,
    defaultSelectedIds,
    onSelectedIdsChange
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<IssueStatus>>(
    new Set()
  );

  const groups = useMemo(
    () =>
      statuses
        .map((status) => ({
          status,
          issues: issues.filter((issue) => issue.status === status),
        }))
        .filter((group) => showEmptyGroups || group.issues.length > 0),
    [issues, statuses, showEmptyGroups]
  );

  /** Rows in visual order, skipping collapsed groups. */
  const visible = useMemo(
    () =>
      groups.flatMap((group) =>
        collapsed.has(group.status) ? [] : group.issues
      ),
    [groups, collapsed]
  );

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const rowId = (id: string) => `${baseId}-row-${id}`;

  const toggle = (id: string) => {
    setSelected(
      selectedSet.has(id) ? selected.filter((s) => s !== id) : [...selected, id]
    );
  };

  const selectRange = (fromId: string, toId: string) => {
    const from = visible.findIndex((i) => i.id === fromId);
    const to = visible.findIndex((i) => i.id === toId);
    if (from < 0 || to < 0) return;
    const [start, end] = from < to ? [from, to] : [to, from];
    const range = visible.slice(start, end + 1).map((i) => i.id);
    setSelected([...new Set([...selected, ...range])]);
  };

  const moveActive = (delta: number, extend: boolean) => {
    if (visible.length === 0) return;
    const index = activeId ? visible.findIndex((i) => i.id === activeId) : -1;
    const nextIndex =
      index < 0
        ? delta > 0
          ? 0
          : visible.length - 1
        : Math.min(visible.length - 1, Math.max(0, index + delta));
    const next = visible[nextIndex];
    if (!next) return;
    if (extend) {
      const anchor = anchorId ?? activeId ?? next.id;
      setAnchorId(anchor);
      selectRange(anchor, next.id);
    } else {
      setAnchorId(next.id);
    }
    setActiveId(next.id);
    document
      .getElementById(rowId(next.id))
      ?.scrollIntoView({ block: "nearest" });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isTypingTarget(event.target)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    switch (event.key) {
      case "ArrowDown":
      case "j":
        event.preventDefault();
        moveActive(1, event.shiftKey);
        break;
      case "ArrowUp":
      case "k":
        event.preventDefault();
        moveActive(-1, event.shiftKey);
        break;
      case "x":
        if (activeId) {
          event.preventDefault();
          toggle(activeId);
          setAnchorId(activeId);
        }
        break;
      case "Enter": {
        const issue = visible.find((i) => i.id === activeId);
        if (issue && event.target === event.currentTarget) {
          event.preventDefault();
          onIssueOpen?.(issue);
        }
        break;
      }
      case "Escape":
        if (selected.length > 0) {
          event.preventDefault();
          setSelected([]);
        }
        break;
    }
  };

  const onRowClick = (issue: Issue, event: MouseEvent<HTMLDivElement>) => {
    // Clicks on the glyph buttons and the checkbox are theirs.
    if ((event.target as HTMLElement).closest("button")) return;
    listRef.current?.focus({ preventScroll: true });
    setActiveId(issue.id);
    if (event.shiftKey && anchorId) {
      selectRange(anchorId, issue.id);
      return;
    }
    setAnchorId(issue.id);
    if (event.metaKey || event.ctrlKey) {
      toggle(issue.id);
      return;
    }
    onIssueOpen?.(issue);
  };

  if (issues.length === 0 && !showEmptyGroups) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1 px-6 py-16 text-center",
          className
        )}
      >
        {empty ?? (
          <>
            <p className="text-sm font-medium text-fg">No issues</p>
            <p className="text-sm text-fg-subtle">
              Issues that match the filters will show up here.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-multiselectable="true"
      aria-label={ariaLabel}
      aria-activedescendant={activeId ? rowId(activeId) : undefined}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setActiveId(null);
      }}
      className={cn(
        "relative flex flex-col outline-none focus-visible:ring-1 focus-visible:ring-focus focus-visible:ring-inset",
        className
      )}
    >
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.status);
        return (
          // biome-ignore lint/a11y/useSemanticElements: a listbox group, not a form fieldset.
          <div
            key={group.status}
            role="group"
            aria-label={statusLabel(group.status)}
          >
            <IssueGroupHeader
              status={group.status}
              count={group.issues.length}
              collapsed={isCollapsed}
              onCollapsedChange={(next) => {
                const copy = new Set(collapsed);
                if (next) copy.add(group.status);
                else copy.delete(group.status);
                setCollapsed(copy);
              }}
              onAdd={onAddIssue ? () => onAddIssue(group.status) : undefined}
            />
            {isCollapsed
              ? null
              : group.issues.map((issue) => (
                  <IssueRow
                    key={issue.id}
                    id={rowId(issue.id)}
                    issue={issue}
                    selected={selectedSet.has(issue.id)}
                    active={activeId === issue.id}
                    selectionMode={selected.length > 0}
                    onSelectedChange={() => {
                      toggle(issue.id);
                      setAnchorId(issue.id);
                    }}
                    onIssueChange={(patch) => onIssueChange?.(issue.id, patch)}
                    onClick={(event) => onRowClick(issue, event)}
                  />
                ))}
          </div>
        );
      })}
    </div>
  );
}

/** Status values in the default board/list order (for building columns). */
export const ISSUE_STATUS_ORDER: readonly IssueStatus[] = ISSUE_STATUSES.map(
  (s) => s.value
);
