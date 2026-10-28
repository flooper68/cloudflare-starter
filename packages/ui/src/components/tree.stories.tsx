import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box, Diamond, FolderKanban, Layers } from "lucide-react";
import { useState } from "react";
import { StatusIcon } from "./issue-icons";
import { Tree, type TreeNode } from "./tree";

const projects: TreeNode[] = [
  {
    id: "mobile",
    label: "Mobile app v3",
    icon: <FolderKanban />,
    trailing: "14/32",
    children: [
      {
        id: "mobile-m1",
        label: "Offline sync",
        icon: <Diamond />,
        trailing: "6/10",
        children: [
          {
            id: "ENG-412",
            label: "Sync stalls when the device goes offline",
            icon: <StatusIcon status="in_progress" label="" />,
          },
          {
            id: "ENG-398",
            label: "Persist upload queue",
            icon: <StatusIcon status="in_review" label="" />,
          },
          {
            id: "ENG-371",
            label: "Conflict resolution UI",
            icon: <StatusIcon status="todo" label="" />,
          },
        ],
      },
      {
        id: "mobile-m2",
        label: "Push notifications",
        icon: <Diamond />,
        trailing: "8/8",
        children: [
          {
            id: "ENG-340",
            label: "Swipe to archive notification",
            icon: <StatusIcon status="done" label="" />,
          },
        ],
      },
      {
        id: "mobile-m3",
        label: "Tablet layout",
        icon: <Diamond />,
        trailing: "0/14",
        disabled: true,
      },
    ],
  },
  {
    id: "billing",
    label: "Billing v2",
    icon: <FolderKanban />,
    trailing: "11/18",
    children: [
      {
        id: "billing-m1",
        label: "Usage-based pricing",
        icon: <Diamond />,
        children: [
          {
            id: "ENG-388",
            label: "Meter API calls per workspace",
            icon: <StatusIcon status="in_progress" label="" />,
          },
        ],
      },
      { id: "billing-m2", label: "Invoices", icon: <Diamond /> },
    ],
  },
  { id: "infra", label: "Platform", icon: <Layers />, trailing: "0/0" },
  { id: "misc", label: "Unsorted", icon: <Box /> },
];

/**
 * A nested, collapsible tree (projects › milestones › issues). Click or press Enter to
 * select; ←/→ collapse and expand, ↑/↓ move, Home/End jump, `*` expands all siblings.
 */
const meta = {
  title: "Data display/Tree",
  component: Tree,
  tags: ["autodocs"],
  args: {
    items: projects,
    label: "Projects",
    defaultExpanded: ["mobile", "mobile-m1"],
    defaultSelected: "ENG-412",
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Tree>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Collapsed: Story = {
  args: { defaultExpanded: [], defaultSelected: null },
};

export const Controlled: Story = {
  render: (args) => {
    const [expanded, setExpanded] = useState<string[]>(["billing"]);
    const [selected, setSelected] = useState<string | null>("billing-m1");
    return (
      <div className="flex flex-col gap-3">
        <Tree
          {...args}
          expanded={expanded}
          onExpandedChange={setExpanded}
          selected={selected}
          onSelectedChange={setSelected}
        />
        <p className="text-xs text-fg-muted">
          Selected: <span className="text-fg">{selected ?? "nothing"}</span> ·
          Expanded: {expanded.join(", ") || "none"}
        </p>
      </div>
    );
  },
};

export const InSidebar: Story = {
  render: (args) => (
    <nav className="flex w-64 flex-col gap-2 rounded-lg border border-line bg-surface p-2">
      <span className="px-2 pt-1 text-xs font-medium text-fg-subtle">
        Your projects
      </span>
      <Tree {...args} />
    </nav>
  ),
};
