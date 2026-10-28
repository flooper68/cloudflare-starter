import {
  type Announcements,
  type ClientRect,
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { focusRing } from "../../lib/styles";
import { cn } from "../../lib/utils";
import { IconButton } from "../button";
import { LabelChip, PersonAvatar } from "./internal";
import {
  type Issue,
  type IssueStatus,
  PriorityIcon,
  priorityLabel,
  StatusIcon,
} from "./issue-glyphs";
import type { IssuePatch } from "./issue-list";
import { GlyphButton, PriorityPicker } from "./issue-pickers";

/**
 * Keyboard drag: ↑/↓ move within a column (dnd-kit's sortable coordinates), ←/→ move the
 * lifted card to the neighbouring column at the same height. dnd-kit's own ←/→ compare left
 * edges, so a card lifted with a sub-pixel offset finds the cards of its own column "to the
 * right" and only moves down.
 */
const boardKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const { code } = event;
  if (code !== "ArrowLeft" && code !== "ArrowRight") {
    return sortableKeyboardCoordinates(event, args);
  }
  const { collisionRect, droppableRects, droppableContainers } = args.context;
  if (!collisionRect) return undefined;
  event.preventDefault();
  const center = collisionRect.left + collisionRect.width / 2;
  let target: ClientRect | undefined;
  let nearest = Number.POSITIVE_INFINITY;
  for (const container of droppableContainers.getEnabled()) {
    // Columns are the droppables without sortable data; cards have it.
    if (container.data.current?.sortable) continue;
    const rect = droppableRects.get(container.id);
    if (!rect) continue;
    const distance =
      code === "ArrowRight" ? rect.left - center : center - rect.right;
    if (distance > 0 && distance < nearest) {
      nearest = distance;
      target = rect;
    }
  }
  if (!target) return undefined;
  return {
    x: target.left + (target.width - collisionRect.width) / 2,
    y: Math.max(
      target.top,
      Math.min(collisionRect.top, target.bottom - collisionRect.height)
    ),
  };
};

export interface KanbanColumn {
  /** Usually the status the column stands for. */
  readonly id: string;
  readonly title: ReactNode;
  /** Glyph before the title; defaults to the status glyph when `status` is set. */
  readonly icon?: ReactNode;
  readonly status?: IssueStatus;
  readonly items: readonly Issue[];
}

export interface KanbanMove {
  readonly issueId: string;
  readonly fromColumnId: string;
  readonly toColumnId: string;
  /** Index in the target column after the move. */
  readonly toIndex: number;
}

/** Applies a move to columns; use it in `onMove` to update your state. */
export function moveKanbanItem(
  columns: readonly KanbanColumn[],
  move: KanbanMove
): KanbanColumn[] {
  const from = columns.find((c) => c.id === move.fromColumnId);
  const item = from?.items.find((i) => i.id === move.issueId);
  if (!item) return [...columns];
  return columns.map((column) => {
    let items = column.items.filter((i) => i.id !== move.issueId);
    if (column.id === move.toColumnId) {
      items = [...items];
      items.splice(move.toIndex, 0, item);
    }
    return { ...column, items };
  });
}

export interface KanbanCardProps {
  readonly issue: Issue;
  /** Rendered in the drag overlay: lifted look. */
  readonly overlay?: boolean;
  readonly onIssueChange?: (patch: IssuePatch) => void;
  readonly onOpen?: () => void;
  readonly className?: string;
}

/** Board card: identifier and assignee, title, then priority, status and labels. */
export function KanbanCard({
  issue,
  overlay = false,
  onIssueChange,
  onOpen,
  className,
}: KanbanCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border border-line bg-surface-raised p-3 text-sm shadow-raised",
        "transition-colors hover:border-line-strong",
        overlay && "rotate-1 cursor-grabbing border-line-strong shadow-overlay",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs tabular-nums text-fg-subtle">
          {issue.identifier}
        </span>
        <PersonAvatar person={issue.assignee} size="sm" />
      </div>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "line-clamp-2 rounded-sm text-left font-medium text-fg",
          focusRing
        )}
      >
        {issue.title}
      </button>
      <div className="flex flex-wrap items-center gap-1">
        <PriorityPicker
          value={issue.priority}
          onValueChange={(priority) => onIssueChange?.({ priority })}
        >
          <GlyphButton
            label={`Priority: ${priorityLabel(issue.priority)}`}
            className="border border-line"
          >
            <PriorityIcon priority={issue.priority} />
          </GlyphButton>
        </PriorityPicker>
        {issue.labels?.map((label) => (
          <LabelChip key={label.id} label={label} />
        ))}
      </div>
    </div>
  );
}

function SortableCard({
  issue,
  onIssueChange,
  onOpen,
}: {
  readonly issue: Issue;
  readonly onIssueChange?: (patch: IssuePatch) => void;
  readonly onOpen?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: issue.id });

  return (
    // biome-ignore lint/a11y/useSemanticElements: a named group of the card's controls, not a fieldset; dnd-kit makes it focusable for keyboard drag.
    <div
      ref={(node) => {
        setNodeRef(node);
        // Only the card itself starts a keyboard drag, not the buttons inside it.
        setActivatorNodeRef(node);
      }}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      {...attributes}
      // A group, not dnd-kit's default button: the card holds buttons of its own.
      role="group"
      tabIndex={attributes.tabIndex}
      {...listeners}
      aria-label={`${issue.identifier} ${issue.title}`}
      className={cn(
        "cursor-grab rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-focus",
        isDragging && "opacity-40"
      )}
    >
      <KanbanCard issue={issue} onIssueChange={onIssueChange} onOpen={onOpen} />
    </div>
  );
}

function Column({
  column,
  onAdd,
  onIssueChange,
  onIssueOpen,
  emptyLabel,
}: {
  readonly column: KanbanColumn;
  readonly onAdd?: () => void;
  readonly onIssueChange?: (id: string, patch: IssuePatch) => void;
  readonly onIssueOpen?: (issue: Issue) => void;
  readonly emptyLabel: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const icon =
    column.icon ??
    (column.status ? <StatusIcon status={column.status} /> : null);

  return (
    <section
      aria-label={typeof column.title === "string" ? column.title : column.id}
      className="flex max-h-full w-72 shrink-0 flex-col rounded-lg bg-hover"
    >
      <header className="flex h-10 items-center gap-2 px-3 text-sm">
        {icon}
        <span className="font-medium text-fg">{column.title}</span>
        <span className="text-fg-subtle tabular-nums">
          {column.items.length}
        </span>
        <span className="flex-1" />
        {onAdd ? (
          <IconButton label="New issue" size="xs" onClick={onAdd}>
            <Plus />
          </IconButton>
        ) : null}
      </header>
      <SortableContext
        id={column.id}
        items={column.items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={cn(
            "flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-md px-2 pb-2 transition-colors",
            isOver && "bg-active"
          )}
        >
          {column.items.map((issue) => (
            <SortableCard
              key={issue.id}
              issue={issue}
              onIssueChange={(patch) => onIssueChange?.(issue.id, patch)}
              onOpen={() => onIssueOpen?.(issue)}
            />
          ))}
          {column.items.length === 0 ? (
            <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-line text-xs text-fg-subtle">
              {emptyLabel}
            </div>
          ) : null}
        </div>
      </SortableContext>
    </section>
  );
}

export interface KanbanBoardProps {
  readonly columns: readonly KanbanColumn[];
  /** A card was dropped somewhere new. Apply it with `moveKanbanItem`. */
  readonly onMove?: (move: KanbanMove) => void;
  readonly onIssueChange?: (id: string, patch: IssuePatch) => void;
  readonly onIssueOpen?: (issue: Issue) => void;
  /** Shows "+" in each column header. */
  readonly onAddIssue?: (columnId: string) => void;
  /** Placeholder in an empty column. */
  readonly emptyLabel?: ReactNode;
  readonly className?: string;
}

/**
 * Linear's board: a column per status with counts, cards you drag within and between columns
 * (mouse, touch or keyboard: focus a card, Space to lift, arrows to move, Space to drop,
 * Escape to cancel). Controlled: render `columns`, apply `onMove`.
 */
export function KanbanBoard({
  columns,
  onMove,
  onIssueChange,
  onIssueOpen,
  onAddIssue,
  emptyLabel = "No issues",
  className,
}: KanbanBoardProps) {
  // While dragging, a local copy shows the card in the column it hovers.
  const [draft, setDraft] = useState<readonly KanbanColumn[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string | null>(null);
  const shown = draft ?? columns;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: boardKeyboardCoordinates,
    })
  );

  const findColumn = (
    cols: readonly KanbanColumn[],
    id: string
  ): KanbanColumn | undefined =>
    cols.find((c) => c.id === id) ??
    cols.find((c) => c.items.some((i) => i.id === id));

  const activeIssue = useMemo(
    () =>
      activeId
        ? shown.flatMap((c) => c.items).find((i) => i.id === activeId)
        : undefined,
    [activeId, shown]
  );

  const onDragStart = ({ active }: DragStartEvent) => {
    const id = String(active.id);
    setActiveId(id);
    setOrigin(findColumn(columns, id)?.id ?? null);
    setDraft(columns);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || !draft) return;
    const activeKey = String(active.id);
    const overKey = String(over.id);
    const fromCol = findColumn(draft, activeKey);
    const toCol = findColumn(draft, overKey);
    if (!fromCol || !toCol || fromCol.id === toCol.id) return;
    const item = fromCol.items.find((i) => i.id === activeKey);
    if (!item) return;
    const overIndex = toCol.items.findIndex((i) => i.id === overKey);
    const index = overIndex < 0 ? toCol.items.length : overIndex;
    setDraft(
      draft.map((c) => {
        if (c.id === fromCol.id)
          return { ...c, items: c.items.filter((i) => i.id !== activeKey) };
        if (c.id === toCol.id) {
          const items = [...c.items];
          items.splice(index, 0, item);
          return { ...c, items };
        }
        return c;
      })
    );
  };

  const reset = () => {
    setDraft(null);
    setActiveId(null);
    setOrigin(null);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const activeKey = String(active.id);
    const current = draft ?? columns;
    const toCol = over ? findColumn(current, String(over.id)) : undefined;
    if (!over || !toCol || !origin) {
      reset();
      return;
    }
    let items = toCol.items;
    const oldIndex = items.findIndex((i) => i.id === activeKey);
    const overIndex = items.findIndex((i) => i.id === String(over.id));
    if (oldIndex >= 0 && overIndex >= 0 && oldIndex !== overIndex) {
      items = arrayMove([...items], oldIndex, overIndex);
    }
    const toIndex = items.findIndex((i) => i.id === activeKey);
    const originalIndex =
      findColumn(columns, origin)?.items.findIndex((i) => i.id === activeKey) ??
      -1;
    if (toIndex >= 0 && (toCol.id !== origin || toIndex !== originalIndex)) {
      onMove?.({
        issueId: activeKey,
        fromColumnId: origin,
        toColumnId: toCol.id,
        toIndex,
      });
    }
    reset();
  };

  const titleOf = (id: string | number | undefined) => {
    const col = id === undefined ? undefined : findColumn(shown, String(id));
    return typeof col?.title === "string" ? col.title : (col?.id ?? "");
  };
  const issueName = (id: string | number) =>
    shown.flatMap((c) => c.items).find((i) => i.id === String(id))
      ?.identifier ?? String(id);

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${issueName(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${issueName(active.id)} is over ${titleOf(over.id)}.`
        : `${issueName(active.id)} is no longer over a column.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${issueName(active.id)} was dropped in ${titleOf(over.id)}.`
        : `${issueName(active.id)} was dropped.`,
    onDragCancel: ({ active }) =>
      `Moving ${issueName(active.id)} was cancelled.`,
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={reset}
      accessibility={{ announcements }}
    >
      <div
        className={cn(
          "flex h-full items-start gap-3 overflow-x-auto p-3",
          className
        )}
      >
        {shown.map((column) => (
          <Column
            key={column.id}
            column={column}
            onAdd={onAddIssue ? () => onAddIssue(column.id) : undefined}
            onIssueChange={onIssueChange}
            onIssueOpen={onIssueOpen}
            emptyLabel={emptyLabel}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 150, easing: "ease-out" }}>
        {activeIssue ? <KanbanCard issue={activeIssue} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
