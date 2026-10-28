import type { Meta, StoryObj } from "@storybook/react-vite";
import { CalendarDays, Plus } from "lucide-react";
import { cn } from "../lib/utils";
import { Avatar } from "./avatar";
import { Button } from "./button";
import { DescriptionItem, DescriptionList } from "./description-list";
import { PriorityIcon, StatusIcon } from "./issue-icons";
import { Link } from "./link";
import { Tag } from "./tag";

/**
 * Label–value pairs, like the properties panel of a Linear issue. Horizontal by default
 * (label column + value column), vertical for narrow places. Values can be text or
 * ghost buttons that open pickers.
 */
const meta = {
  title: "Data display/DescriptionList",
  component: DescriptionList,
  tags: ["autodocs"],
  args: { orientation: "horizontal", labelWidth: "6.5rem" },
  argTypes: {
    orientation: {
      control: "inline-radio",
      options: ["horizontal", "vertical"],
    },
  },
} satisfies Meta<typeof DescriptionList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <DescriptionList {...args} className="w-80">
      <DescriptionItem label="Workspace">Acme Inc.</DescriptionItem>
      <DescriptionItem label="Plan">Business, 48 seats</DescriptionItem>
      <DescriptionItem label="Region">EU (Frankfurt)</DescriptionItem>
      <DescriptionItem label="Created">March 3, 2024</DescriptionItem>
    </DescriptionList>
  ),
};

export const Vertical: Story = {
  args: { orientation: "vertical" },
  render: (args) => (
    <DescriptionList {...args} className="w-64">
      <DescriptionItem label="API key">
        <code className="font-mono text-xs">lin_api_••••••••3f9a</code>
      </DescriptionItem>
      <DescriptionItem label="Last used">
        2 hours ago from 81.2.69.160
      </DescriptionItem>
      <DescriptionItem label="Scopes">
        read, write, issues:create
      </DescriptionItem>
    </DescriptionList>
  ),
};

const value = "-ml-2 h-7 justify-start px-2 text-fg font-normal";

export const IssueSidebar: Story = {
  render: () => (
    <aside className="flex w-72 flex-col gap-4 rounded-lg border border-line bg-surface p-4">
      <h3 className="text-xs font-medium text-fg-muted">Properties</h3>
      <DescriptionList>
        <DescriptionItem label="Status">
          <Button
            variant="ghost"
            size="sm"
            className={value}
            icon={<StatusIcon status="in_progress" label="" />}
          >
            In Progress
          </Button>
        </DescriptionItem>
        <DescriptionItem label="Priority">
          <Button
            variant="ghost"
            size="sm"
            className={value}
            icon={<PriorityIcon priority="urgent" label="" />}
          >
            Urgent
          </Button>
        </DescriptionItem>
        <DescriptionItem label="Assignee">
          <Button
            variant="ghost"
            size="sm"
            className={value}
            icon={<Avatar name="Ada Lovelace" size="xs" />}
          >
            Ada Lovelace
          </Button>
        </DescriptionItem>
        <DescriptionItem label="Labels">
          <span className="flex flex-wrap gap-1">
            <Tag size="sm" color="danger">
              Bug
            </Tag>
            <Tag size="sm" color="warning">
              Performance
            </Tag>
          </span>
        </DescriptionItem>
        <DescriptionItem label="Project">
          <Link variant="subtle" href="#mobile-app-v3">
            Mobile app v3
          </Link>
        </DescriptionItem>
        <DescriptionItem label="Due date">
          <Button
            variant="ghost"
            size="sm"
            className={cn(value, "text-fg-muted")}
            icon={<CalendarDays />}
          >
            Set due date
          </Button>
        </DescriptionItem>
        <DescriptionItem label="Cycle">
          <Button
            variant="ghost"
            size="sm"
            className={cn(value, "text-fg-muted")}
            icon={<Plus />}
          >
            Add to cycle
          </Button>
        </DescriptionItem>
      </DescriptionList>
    </aside>
  ),
};
