import type { Meta, StoryObj } from "@storybook/react-vite";
import { Columns3, GanttChart, List, Rows3 } from "lucide-react";
import { useState } from "react";
import { SegmentedControl, SegmentedControlItem } from "./segmented-control";

/**
 * Switch between a few views or modes. One segment is always selected; arrow keys move
 * between segments. Icon-only segments need `label`.
 */
const meta = {
  title: "Forms/SegmentedControl",
  component: SegmentedControl,
  tags: ["autodocs"],
  args: {
    defaultValue: "list",
    size: "md",
    disabled: false,
    "aria-label": "Layout",
  },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md"] },
  },
  render: (args) => (
    <SegmentedControl {...args}>
      <SegmentedControlItem value="list" icon={<List />}>
        List
      </SegmentedControlItem>
      <SegmentedControlItem value="board" icon={<Columns3 />}>
        Board
      </SegmentedControlItem>
      <SegmentedControlItem value="timeline" icon={<GanttChart />}>
        Timeline
      </SegmentedControlItem>
    </SegmentedControl>
  ),
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Small: Story = {
  args: { size: "sm" },
};

export const TextOnly: Story = {
  render: () => (
    <SegmentedControl defaultValue="active" aria-label="Issue filter">
      <SegmentedControlItem value="all">All issues</SegmentedControlItem>
      <SegmentedControlItem value="active">Active</SegmentedControlItem>
      <SegmentedControlItem value="backlog">Backlog</SegmentedControlItem>
    </SegmentedControl>
  ),
};

export const IconOnly: Story = {
  render: () => (
    <SegmentedControl defaultValue="list" size="sm" aria-label="Density">
      <SegmentedControlItem value="list" icon={<List />} label="List" />
      <SegmentedControlItem
        value="compact"
        icon={<Rows3 />}
        label="Compact list"
      />
      <SegmentedControlItem value="board" icon={<Columns3 />} label="Board" />
    </SegmentedControl>
  ),
};

export const DisabledItem: Story = {
  render: () => (
    <SegmentedControl defaultValue="list" aria-label="Layout">
      <SegmentedControlItem value="list" icon={<List />}>
        List
      </SegmentedControlItem>
      <SegmentedControlItem value="board" icon={<Columns3 />}>
        Board
      </SegmentedControlItem>
      <SegmentedControlItem value="timeline" icon={<GanttChart />} disabled>
        Timeline
      </SegmentedControlItem>
    </SegmentedControl>
  ),
};

/** In a view header, switching the layout of the issue list. */
export const InAViewHeader: Story = {
  render: function Render() {
    const [layout, setLayout] = useState("board");
    return (
      <div className="flex w-[520px] items-center justify-between rounded-lg border border-line bg-surface-raised px-3 py-2">
        <span className="font-medium text-fg text-sm">
          Engineering · Active issues
        </span>
        <SegmentedControl
          size="sm"
          value={layout}
          onValueChange={setLayout}
          aria-label="Layout"
        >
          <SegmentedControlItem value="list" icon={<List />} label="List" />
          <SegmentedControlItem
            value="board"
            icon={<Columns3 />}
            label="Board"
          />
          <SegmentedControlItem
            value="timeline"
            icon={<GanttChart />}
            label="Timeline"
          />
        </SegmentedControl>
      </div>
    );
  },
};
