import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Avatar } from "./avatar";
import { IconButton } from "./button";
import {
  type IssuePriority,
  type IssueStatus,
  issueStatusLabel,
  PriorityIcon,
  StatusIcon,
} from "./issue-icons";
import { List, ListHeader, ListItem } from "./list";
import { Tag } from "./tag";

interface Row {
  id: string;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  assignee: string;
  label?: { name: string; color: "danger" | "accent" | "info" };
  date: string;
}

const rows: Row[] = [
  {
    id: "ENG-412",
    title: "Sync stalls when the device goes offline mid-upload",
    status: "in_progress",
    priority: "urgent",
    assignee: "Ada Lovelace",
    label: { name: "Bug", color: "danger" },
    date: "Oct 24",
  },
  {
    id: "ENG-405",
    title: "Keyboard shortcut for moving issues between cycles",
    status: "in_progress",
    priority: "medium",
    assignee: "Grace Hopper",
    label: { name: "Feature", color: "accent" },
    date: "Oct 22",
  },
  {
    id: "ENG-398",
    title: "Paginate the audit log API",
    status: "in_review",
    priority: "high",
    assignee: "Alan Turing",
    label: { name: "Improvement", color: "info" },
    date: "Oct 21",
  },
  {
    id: "ENG-391",
    title: "Remove legacy webhooks v1 endpoints",
    status: "todo",
    priority: "low",
    assignee: "Barbara Liskov",
    date: "Oct 19",
  },
  {
    id: "ENG-384",
    title: "Slack notification shows raw markdown",
    status: "todo",
    priority: "none",
    assignee: "Katherine Johnson",
    label: { name: "Bug", color: "danger" },
    date: "Oct 18",
  },
];

function IssueRow({
  row,
  selected,
  onSelect,
}: {
  readonly row: Row;
  readonly selected?: boolean;
  readonly onSelect?: () => void;
}) {
  return (
    <ListItem
      selected={selected}
      onSelect={onSelect}
      leading={
        <>
          <PriorityIcon priority={row.priority} />
          <span className="w-14 whitespace-nowrap text-xs tabular-nums">
            {row.id}
          </span>
          <StatusIcon status={row.status} />
        </>
      }
      title={row.title}
      trailing={
        <>
          {row.label ? (
            <Tag size="sm" color={row.label.color}>
              {row.label.name}
            </Tag>
          ) : null}
          <span className="w-12 text-right">{row.date}</span>
          <Avatar name={row.assignee} size="sm" />
        </>
      }
    />
  );
}

/**
 * Linear-style rows for issue lists, inbox and search results. Focus a row and use
 * ↑/↓ (or j/k), Home/End; Enter or Space activates it. Group rows with `ListHeader`.
 */
const meta = {
  title: "Data display/List",
  component: ListItem,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    title: "Sync stalls when the device goes offline mid-upload",
    description: "ENG-412",
    selected: false,
    disabled: false,
  },
  decorators: [
    (Story) => (
      <List label="Issues" className="rounded-lg border border-line">
        <Story />
      </List>
    ),
  ],
} satisfies Meta<typeof ListItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const States: Story = {
  render: () => (
    <>
      <ListItem title="Default row" trailing="Oct 24" />
      <ListItem title="Selected row" selected trailing="Oct 22" />
      <ListItem title="Disabled row" disabled trailing="Oct 21" />
      <ListItem
        title="With a description"
        description="Opened by Grace Hopper"
        trailing="Oct 19"
      />
    </>
  ),
};

export const IssueList: Story = {
  decorators: [(Story) => <Story />],
  render: () => {
    const [selected, setSelected] = useState("ENG-405");
    const groups: IssueStatus[] = ["in_progress", "in_review", "todo"];
    return (
      <List
        label="Active issues"
        className="w-[720px] overflow-hidden rounded-lg border border-line"
      >
        {groups.map((status) => {
          const inGroup = rows.filter((row) => row.status === status);
          return (
            <div key={status}>
              <ListHeader
                icon={<StatusIcon status={status} label="" />}
                count={inGroup.length}
                actions={
                  <IconButton label="Add issue" size="xs">
                    <Plus />
                  </IconButton>
                }
              >
                {issueStatusLabel[status]}
              </ListHeader>
              {inGroup.map((row) => (
                <IssueRow
                  key={row.id}
                  row={row}
                  selected={row.id === selected}
                  onSelect={() => setSelected(row.id)}
                />
              ))}
            </div>
          );
        })}
      </List>
    );
  },
};

export const Empty: Story = {
  render: () => (
    <div className="flex h-24 w-[480px] items-center justify-center text-sm text-fg-muted">
      No issues match the current filters.
    </div>
  ),
};
