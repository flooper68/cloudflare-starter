import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useState } from "react";

import { issues as fixtureIssues } from "./fixtures";
import type { Issue } from "./issue-glyphs";
import { IssueList, IssueRow } from "./issue-list";

/**
 * Linear's dense issue list, grouped by status. Click a priority or status glyph to change
 * it. Select with the checkbox (shown on hover), ⌘-click or Shift-click; with the list
 * focused use ↑/↓ (or j/k) to move, `x` to select, Shift+↑/↓ to extend, Enter to open and
 * Escape to clear the selection.
 */
const meta = {
  title: "Patterns/IssueList",
  component: IssueList,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    issues: fixtureIssues,
    showEmptyGroups: false,
    onIssueOpen: () => {},
    onAddIssue: () => {},
  },
} satisfies Meta<typeof IssueList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Stateful: pickers update the issue, the selection is tracked. */
function Stateful(props: Partial<ComponentProps<typeof IssueList>>) {
  const [issues, setIssues] = useState<readonly Issue[]>(fixtureIssues);
  const [selected, setSelected] = useState<readonly string[]>(
    props.defaultSelectedIds ?? []
  );
  return (
    <div className="flex h-dvh flex-col bg-surface">
      <div className="flex h-9 items-center border-b border-line px-4 text-xs text-fg-subtle">
        {selected.length > 0
          ? `${selected.length} selected`
          : `${issues.length} issues`}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <IssueList
          {...props}
          issues={issues}
          selectedIds={selected}
          onSelectedIdsChange={setSelected}
          onIssueChange={(id, patch) =>
            setIssues((all) =>
              all.map((i) => (i.id === id ? { ...i, ...patch } : i))
            )
          }
        />
      </div>
    </div>
  );
}

export const Playground: Story = {
  render: (args) => (
    <Stateful
      onIssueOpen={args.onIssueOpen}
      onAddIssue={args.onAddIssue}
      showEmptyGroups={args.showEmptyGroups}
    />
  ),
};

export const WithSelection: Story = {
  render: () => <Stateful defaultSelectedIds={["i-142", "i-155", "i-160"]} />,
};

export const EmptyGroups: Story = {
  args: { showEmptyGroups: true, issues: fixtureIssues.slice(0, 4) },
  render: (args) => (
    <div className="bg-surface">
      <IssueList {...args} />
    </div>
  ),
};

export const Empty: Story = {
  args: { issues: [] },
  render: (args) => (
    <div className="bg-surface">
      <IssueList {...args} />
    </div>
  ),
};

/** A single row, e.g. for search results or a related-issues list. */
export const SingleRow: Story = {
  parameters: { layout: "padded" },
  render: () => {
    const issue = fixtureIssues[0] as Issue;
    return (
      <div className="max-w-3xl rounded-lg border border-line bg-surface">
        <IssueRow issue={issue} />
        <IssueRow issue={fixtureIssues[2] as Issue} selected />
        <IssueRow issue={fixtureIssues[6] as Issue} active />
      </div>
    );
  },
};
