import type { Meta, StoryObj } from "@storybook/react-vite";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { Button } from "../button";
import { type Filter, FilterBar, matchesFilters } from "./filter-bar";
import { filterProperties, issueProperty, issues } from "./fixtures";
import { IssueList } from "./issue-list";

/**
 * Linear-style filter chips: property → operator → values. "Filter" opens a searchable list
 * of properties, then that property's values (multi-select, Backspace goes back). Click any
 * part of a chip to change it, × to remove it. Controlled through `value`/`onValueChange`;
 * `matchesFilters(item, filters, get)` applies them.
 */
const meta = {
  title: "Patterns/FilterBar",
  component: FilterBar,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { properties: filterProperties },
  argTypes: { properties: { control: false } },
} satisfies Meta<typeof FilterBar>;

export default meta;
type Story = StoryObj<typeof meta>;

const preset: readonly Filter[] = [
  {
    id: "f-status",
    property: "status",
    operator: "is",
    values: ["in_progress", "todo"],
  },
  { id: "f-assignee", property: "assignee", operator: "is", values: ["u-ada"] },
  {
    id: "f-priority",
    property: "priority",
    operator: "is",
    values: ["urgent"],
  },
];

export const Playground: Story = {
  render: (args) => (
    <div className="bg-surface">
      <FilterBar {...args} defaultValue={preset} />
    </div>
  ),
};

export const Empty: Story = {
  render: (args) => (
    <div className="bg-surface">
      <FilterBar {...args} />
    </div>
  ),
};

/** The "+ Filter" popover open on load. */
export const Open: Story = {
  parameters: { docs: { story: { height: "360px" } } },
  render: (args) => (
    <div className="h-96 bg-surface">
      <FilterBar {...args} defaultOpen />
    </div>
  ),
};

/** Filters applied to an issue list, with a Display button on the right. */
export const WithIssueList: Story = {
  render: function Render(args) {
    const [filters, setFilters] = useState<readonly Filter[]>([
      {
        id: "f-1",
        property: "priority",
        operator: "is_not",
        values: ["none", "low"],
      },
    ]);
    const shown = issues.filter((i) =>
      matchesFilters(i, filters, issueProperty)
    );
    return (
      <div className="flex h-dvh flex-col bg-surface">
        <FilterBar
          {...args}
          value={filters}
          onValueChange={setFilters}
          actions={
            <Button variant="secondary" size="sm" icon={<SlidersHorizontal />}>
              Display
            </Button>
          }
        />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <IssueList issues={shown} />
        </div>
      </div>
    );
  },
};
