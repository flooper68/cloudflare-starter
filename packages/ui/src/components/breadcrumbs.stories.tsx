import type { Meta, StoryObj } from "@storybook/react-vite";
import { Diamond, FolderKanban, Users } from "lucide-react";
import { Breadcrumbs } from "./breadcrumbs";
import { StatusIcon } from "./issue-icons";

/**
 * Where the current page sits in the hierarchy. The last item is the current page; long
 * trails collapse the middle into a "…" menu (`maxItems`).
 */
const meta = {
  title: "Navigation/Breadcrumbs",
  component: Breadcrumbs,
  tags: ["autodocs"],
  args: {
    items: [
      { label: "Engineering", href: "#team", icon: <Users /> },
      { label: "Projects", href: "#projects" },
      { label: "Mobile app v3", href: "#project", icon: <FolderKanban /> },
    ],
    maxItems: 4,
  },
} satisfies Meta<typeof Breadcrumbs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Collapsed: Story = {
  args: {
    items: [
      { label: "Engineering", href: "#team", icon: <Users /> },
      { label: "Projects", href: "#projects" },
      { label: "Mobile app v3", href: "#project", icon: <FolderKanban /> },
      { label: "Offline sync", href: "#milestone", icon: <Diamond /> },
      { label: "ENG-398", href: "#parent" },
      {
        label: "ENG-412 Sync stalls when offline",
        icon: <StatusIcon status="in_progress" label="" />,
      },
    ],
    maxItems: 4,
  },
};

export const CustomSeparator: Story = {
  args: {
    separator: <span className="px-0.5 text-fg-subtle">/</span>,
    items: [
      { label: "acme", href: "#workspace" },
      { label: "settings", href: "#settings" },
      { label: "api" },
    ],
  },
};

export const SingleItem: Story = {
  args: { items: [{ label: "Inbox" }] },
};

export const InHeader: Story = {
  render: () => (
    <header className="flex h-11 w-[640px] items-center justify-between border-b border-line px-3">
      <Breadcrumbs
        items={[
          { label: "Engineering", href: "#team", icon: <Users /> },
          { label: "Mobile app v3", href: "#project", icon: <FolderKanban /> },
          {
            label: "ENG-412",
            icon: <StatusIcon status="in_progress" label="" />,
          },
        ]}
      />
      <span className="text-xs text-fg-subtle">3 / 32</span>
    </header>
  ),
};
