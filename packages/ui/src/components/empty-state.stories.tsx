import type { Meta, StoryObj } from "@storybook/react-vite";
import { FolderKanban, Inbox, Plus, SearchX, Upload } from "lucide-react";
import { Button } from "./button";
import { Card, CardHeader, CardTitle } from "./card";
import { EmptyState } from "./empty-state";
import { Shortcut } from "./kbd";

/**
 * What to show when a view has nothing in it: say why and offer the next step. `page`
 * for an empty view, `compact` for an empty list inside a card, panel or popover.
 */
const meta = {
  title: "Feedback/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  args: {
    variant: "page",
    icon: <FolderKanban />,
    title: "No projects yet",
    description:
      "Projects group issues toward a goal with a target date. Create one to plan your next release.",
    primaryAction: (
      <Button variant="primary" icon={<Plus />}>
        New project
      </Button>
    ),
    secondaryAction: <Button variant="ghost">Learn more</Button>,
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["page", "compact"] },
    icon: { control: false },
    primaryAction: { control: false },
    secondaryAction: { control: false },
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Page: Story = {
  args: {
    icon: <Inbox />,
    title: "You’re all caught up",
    description: "New notifications about issues you follow will show up here.",
    primaryAction: undefined,
    secondaryAction: undefined,
  },
};

export const Compact: Story = {
  args: {
    variant: "compact",
    icon: <SearchX />,
    title: "No issues match these filters",
    description: "Try removing the “Assignee: me” filter.",
    primaryAction: (
      <Button size="sm" variant="secondary">
        Clear filters
      </Button>
    ),
    secondaryAction: undefined,
  },
};

export const WithoutIcon: Story = {
  args: { icon: undefined, variant: "compact", secondaryAction: undefined },
};

/** An empty Backlog inside a card, with two ways out. */
export const InCard: Story = {
  render: () => (
    <Card className="w-[28rem]">
      <CardHeader>
        <CardTitle>Backlog</CardTitle>
      </CardHeader>
      <EmptyState
        variant="compact"
        icon={<Upload />}
        title="The backlog is empty"
        description="Create an issue or import from Jira, GitHub or a CSV file."
        primaryAction={
          <Button
            size="sm"
            variant="primary"
            trailing={<Shortcut keys={["C"]} />}
          >
            New issue
          </Button>
        }
        secondaryAction={
          <Button size="sm" variant="ghost">
            Import
          </Button>
        }
      />
    </Card>
  ),
};
