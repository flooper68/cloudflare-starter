import type { Meta, StoryObj } from "@storybook/react-vite";
import { Archive, Bell, Link2, Plus } from "lucide-react";

import { IconButton } from "./button";
import { Tooltip } from "./tooltip";

/** A short hint on hover or focus, optionally with the keyboard shortcut. */
const meta = {
  title: "Overlays/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  args: {
    content: "Create issue",
    shortcut: ["C"],
    side: "top",
    children: (
      <IconButton label="Create issue" variant="secondary">
        <Plus />
      </IconButton>
    ),
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Toolbar: Story = {
  render: () => (
    <div className="flex gap-1 rounded-lg border border-line bg-surface p-1">
      <Tooltip content="Copy link" shortcut={["⌘", "⇧", "C"]}>
        <IconButton label="Copy link" size="sm">
          <Link2 />
        </IconButton>
      </Tooltip>
      <Tooltip content="Subscribe" shortcut={["⇧", "S"]}>
        <IconButton label="Subscribe" size="sm">
          <Bell />
        </IconButton>
      </Tooltip>
      <Tooltip content="Archive">
        <IconButton label="Archive" size="sm">
          <Archive />
        </IconButton>
      </Tooltip>
    </div>
  ),
};
