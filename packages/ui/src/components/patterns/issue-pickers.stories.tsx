import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Button } from "../button";
import { allPeople } from "./fixtures";
import { PersonAvatar } from "./internal";
import {
  type IssuePriority,
  type IssueStatus,
  PriorityIcon,
  priorityLabel,
  StatusIcon,
  statusLabel,
} from "./issue-glyphs";
import {
  AssigneePicker,
  GlyphButton,
  PriorityPicker,
  StatusPicker,
} from "./issue-pickers";

/**
 * Popover pickers on cmdk for an issue's status, priority and assignee: type to search,
 * ↑/↓ and Enter, or press a number key to pick directly. The current value has a check.
 * The trigger is your own element, usually a glyph button.
 */
const meta = {
  title: "Patterns/Pickers",
  component: StatusPicker,
  tags: ["autodocs"],
  args: {
    value: "in_progress",
    onValueChange: () => {},
    children: null,
  },
  argTypes: { children: { control: false } },
} satisfies Meta<typeof StatusPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: function Render(args) {
    const [value, setValue] = useState<IssueStatus>(args.value);
    return (
      <StatusPicker value={value} onValueChange={setValue}>
        <Button
          variant="secondary"
          size="sm"
          icon={<StatusIcon status={value} />}
        >
          {statusLabel(value)}
        </Button>
      </StatusPicker>
    );
  },
};

/** Open on load, so the docs page shows the list. */
export const StatusOpen: Story = {
  parameters: { docs: { story: { height: "320px" } } },
  render: function Render() {
    const [value, setValue] = useState<IssueStatus>("todo");
    return (
      <div className="h-80">
        <StatusPicker value={value} onValueChange={setValue} defaultOpen>
          <GlyphButton label={`Status: ${statusLabel(value)}`}>
            <StatusIcon status={value} />
          </GlyphButton>
        </StatusPicker>
      </div>
    );
  },
};

export const Priority: Story = {
  parameters: { docs: { story: { height: "300px" } } },
  render: function Render() {
    const [value, setValue] = useState<IssuePriority>("high");
    return (
      <div className="h-72">
        <PriorityPicker value={value} onValueChange={setValue} defaultOpen>
          <Button
            variant="secondary"
            size="sm"
            icon={<PriorityIcon priority={value} />}
          >
            {priorityLabel(value)}
          </Button>
        </PriorityPicker>
      </div>
    );
  },
};

export const Assignee: Story = {
  render: function Render() {
    const [value, setValue] = useState<string | null>("u-chloe");
    const person = allPeople.find((p) => p.id === value) ?? null;
    return (
      <AssigneePicker people={allPeople} value={value} onValueChange={setValue}>
        <Button
          variant="secondary"
          size="sm"
          icon={<PersonAvatar person={person} size="xs" />}
        >
          {person?.name ?? "Assign"}
        </Button>
      </AssigneePicker>
    );
  },
};

/** All glyphs, for reference. */
export const Glyphs: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-8 text-sm">
      <ul className="flex flex-col gap-2">
        {(
          [
            "backlog",
            "todo",
            "in_progress",
            "in_review",
            "done",
            "canceled",
          ] as const
        ).map((s) => (
          <li key={s} className="flex items-center gap-2">
            <StatusIcon status={s} />
            {statusLabel(s)}
          </li>
        ))}
      </ul>
      <ul className="flex flex-col gap-2">
        {(["urgent", "high", "medium", "low", "none"] as const).map((p) => (
          <li key={p} className="flex items-center gap-2">
            <PriorityIcon priority={p} />
            {priorityLabel(p)}
          </li>
        ))}
      </ul>
    </div>
  ),
};
