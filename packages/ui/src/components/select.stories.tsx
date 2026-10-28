import type { Meta, StoryObj } from "@storybook/react-vite";
import { Calendar, CalendarRange, Clock } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Field } from "./field";
import {
  type IssuePriority,
  type IssueStatus,
  issuePriorities,
  issuePriorityLabel,
  issueStatuses,
  issueStatusLabel,
  PriorityIcon,
  StatusIcon,
} from "./issue-icons";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
} from "./select";

/**
 * A select for short, fixed lists (status, priority, cycle length). Same heights as Input;
 * items take an `icon` that also shows in the trigger once picked. For long or searchable
 * lists use Combobox.
 */
const meta = {
  title: "Forms/Select",
  component: Select,
  tags: ["autodocs"],
  args: {
    placeholder: "Set status",
    size: "md",
    disabled: false,
    "aria-label": "Status",
    children: null,
  },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
  },
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <Select {...args}>
      {issueStatuses.map((status) => (
        <SelectItem
          key={status}
          value={status}
          icon={<StatusIcon status={status} label="" />}
        >
          {issueStatusLabel[status]}
        </SelectItem>
      ))}
    </Select>
  ),
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Open: Story = {
  args: { defaultOpen: true, defaultValue: "in_progress" },
  decorators: [
    (Story) => (
      <div className="h-80">
        <Story />
      </div>
    ),
  ],
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {(["sm", "md", "lg"] as const).map((size) => (
        <Select
          key={size}
          size={size}
          defaultValue="todo"
          aria-label={`Status (${size})`}
        >
          {issueStatuses.map((status) => (
            <SelectItem
              key={status}
              value={status}
              icon={<StatusIcon status={status} label="" />}
            >
              {issueStatusLabel[status]}
            </SelectItem>
          ))}
        </Select>
      ))}
    </div>
  ),
};

export const GroupsAndDisabledItems: Story = {
  render: () => (
    <Select defaultValue="2w" aria-label="Cycle length" defaultOpen>
      <SelectGroup>
        <SelectLabel>Cycles</SelectLabel>
        <SelectItem value="1w" icon={<Clock />} description="Fast">
          1 week
        </SelectItem>
        <SelectItem value="2w" icon={<Clock />}>
          2 weeks
        </SelectItem>
        <SelectItem value="3w" icon={<Clock />} disabled>
          3 weeks
        </SelectItem>
      </SelectGroup>
      <SelectSeparator />
      <SelectGroup>
        <SelectLabel>Longer</SelectLabel>
        <SelectItem value="4w" icon={<Calendar />}>
          4 weeks
        </SelectItem>
        <SelectItem
          value="8w"
          icon={<CalendarRange />}
          disabled
          description="Business"
        >
          8 weeks
        </SelectItem>
      </SelectGroup>
    </Select>
  ),
  decorators: [
    (Story) => (
      <div className="h-80">
        <Story />
      </div>
    ),
  ],
};

export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Field label="Placeholder">
        <Select placeholder="Set priority">
          {issuePriorities.map((priority) => (
            <SelectItem key={priority} value={priority}>
              {issuePriorityLabel[priority]}
            </SelectItem>
          ))}
        </Select>
      </Field>
      <Field label="Disabled">
        <Select disabled defaultValue="high">
          <SelectItem
            value="high"
            icon={<PriorityIcon priority="high" label="" />}
          >
            High
          </SelectItem>
        </Select>
      </Field>
      <Field
        label="Priority"
        error="Choose a priority before moving to In Progress"
      >
        <Select placeholder="Set priority">
          {issuePriorities.map((priority) => (
            <SelectItem key={priority} value={priority}>
              {issuePriorityLabel[priority]}
            </SelectItem>
          ))}
        </Select>
      </Field>
    </div>
  ),
};

export const InIssueProperties: Story = {
  render: function Render() {
    const [status, setStatus] = useState<IssueStatus>("in_review");
    const [priority, setPriority] = useState<IssuePriority>("high");
    return (
      <Card className="w-80">
        <CardHeader>
          <CardTitle>ENG-2148 Slow people picker</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Field label="Status">
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as IssueStatus)}
            >
              {issueStatuses.map((item) => (
                <SelectItem
                  key={item}
                  value={item}
                  icon={<StatusIcon status={item} label="" />}
                >
                  {issueStatusLabel[item]}
                </SelectItem>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select
              value={priority}
              onValueChange={(value) => setPriority(value as IssuePriority)}
            >
              {issuePriorities.map((item) => (
                <SelectItem
                  key={item}
                  value={item}
                  icon={<PriorityIcon priority={item} label="" />}
                >
                  {issuePriorityLabel[item]}
                </SelectItem>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>
    );
  },
};
