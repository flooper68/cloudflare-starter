import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

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

/**
 * Interaction test: with the list focused, ↓ moves the active row, x selects it,
 * Shift+↓ extends the selection, Escape clears it and Enter opens the active issue.
 */
export const KeyboardNavigation: Story = {
  args: { onIssueOpen: fn() },
  render: (args) => <Stateful onIssueOpen={args.onIssueOpen} />,
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);
    const grid = canvas.getByRole("grid");
    const rows = () =>
      canvas.getAllByRole("row").filter((row) => row.id !== "");
    const activeRow = () =>
      canvasElement.ownerDocument.getElementById(
        grid.getAttribute("aria-activedescendant") ?? ""
      );

    await step("↓ makes the first row active, j the next", async () => {
      grid.focus();
      await userEvent.keyboard("{ArrowDown}");
      await expect(activeRow()).toBe(rows()[0]);
      await userEvent.keyboard("j");
      await expect(activeRow()).toBe(rows()[1]);
      await userEvent.keyboard("k");
      await expect(activeRow()).toBe(rows()[0]);
    });

    await step("x selects; Shift+↓ extends the selection", async () => {
      await userEvent.keyboard("x");
      await expect(rows()[0]).toHaveAttribute("aria-selected", "true");
      await userEvent.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}");
      await expect(canvas.getByText("3 selected")).toBeVisible();
      for (const row of rows().slice(0, 3)) {
        await expect(row).toHaveAttribute("aria-selected", "true");
      }
      await expect(rows()[3]).toHaveAttribute("aria-selected", "false");
    });

    await step("Escape clears the selection", async () => {
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(canvas.queryByText(/selected$/)).toBeNull());
    });

    await step("Enter opens the active issue", async () => {
      await userEvent.keyboard("{Enter}");
      await expect(args.onIssueOpen).toHaveBeenCalledTimes(1);
      await expect(args.onIssueOpen).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: expect.stringMatching(/^ENG-/) })
      );
    });
  },
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

/** Rows outside an IssueList (search results, related issues) go inside a `role="grid"`. */
export const SingleRow: Story = {
  parameters: { layout: "padded" },
  render: () => {
    const issue = fixtureIssues[0] as Issue;
    return (
      // biome-ignore lint/a11y/useSemanticElements: IssueRow is a flex row of an ARIA grid.
      <div
        role="grid"
        aria-label="Related issues"
        className="max-w-3xl rounded-lg border border-line bg-surface"
      >
        {/* biome-ignore lint/a11y/useSemanticElements: see the grid above. */}
        <div role="rowgroup">
          <IssueRow issue={issue} />
          <IssueRow issue={fixtureIssues[2] as Issue} selected />
          <IssueRow issue={fixtureIssues[6] as Issue} active />
        </div>
      </div>
    );
  },
};
