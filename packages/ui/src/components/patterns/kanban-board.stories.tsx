import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { issues } from "./fixtures";
import { type IssueStatus, statusLabel } from "./issue-glyphs";
import { KanbanBoard, type KanbanColumn, moveKanbanItem } from "./kanban-board";

/**
 * A board with a column per status. Drag cards within and between columns with the mouse,
 * or focus a card and press Space, move with the arrow keys, Space to drop (Escape cancels).
 * Controlled: pass `columns`, apply each `onMove` with `moveKanbanItem`.
 */
const meta = {
  title: "Patterns/KanbanBoard",
  component: KanbanBoard,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { columns: [] },
  argTypes: { columns: { control: false } },
} satisfies Meta<typeof KanbanBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

const boardStatuses: readonly IssueStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
];

function buildColumns(statuses: readonly IssueStatus[]): KanbanColumn[] {
  return statuses.map((status) => ({
    id: status,
    status,
    title: statusLabel(status),
    items: issues.filter((i) => i.status === status),
  }));
}

function StatefulBoard({
  initial,
}: {
  readonly initial: readonly KanbanColumn[];
}) {
  const [columns, setColumns] = useState<readonly KanbanColumn[]>(initial);
  return (
    <div className="h-dvh bg-surface">
      <KanbanBoard
        columns={columns}
        onMove={(move) =>
          setColumns((cols) =>
            moveKanbanItem(cols, move).map((c) => ({
              ...c,
              // A card dropped in a status column takes that status.
              items: c.items.map((i) =>
                c.status && i.status !== c.status
                  ? { ...i, status: c.status }
                  : i
              ),
            }))
          )
        }
        onIssueChange={(id, patch) =>
          setColumns((cols) =>
            cols.map((c) => ({
              ...c,
              items: c.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
            }))
          )
        }
        onAddIssue={() => {}}
      />
    </div>
  );
}

export const Playground: Story = {
  render: () => <StatefulBoard initial={buildColumns(boardStatuses)} />,
};

/** Empty columns show a drop placeholder. */
export const EmptyColumns: Story = {
  render: () => (
    <StatefulBoard
      initial={buildColumns(boardStatuses).map((c) =>
        c.id === "in_review" || c.id === "done" ? { ...c, items: [] } : c
      )}
    />
  ),
};
