import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  issuePriorities,
  issuePriorityLabel,
  issueStatuses,
  issueStatusLabel,
  PriorityIcon,
  StatusIcon,
} from "./issue-icons";

/**
 * Linear-style issue glyphs. `StatusIcon` draws the workflow state (backlog, todo, in
 * progress, in review, done, canceled); `PriorityIcon` the priority bars. Both are plain
 * SVG coloured from tokens, with an accessible name (pass `label=""` when the text next
 * to them already says it). The state and priority lists and labels are exported too.
 */
const meta = {
  title: "Data display/Issue icons",
  component: StatusIcon,
  tags: ["autodocs"],
  args: { status: "in_progress" },
  argTypes: {
    status: { control: "select", options: issueStatuses },
  },
} satisfies Meta<typeof StatusIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Statuses: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      {issueStatuses.map((status) => (
        <div key={status} className="flex items-center gap-2 text-sm text-fg">
          <StatusIcon status={status} label="" />
          {issueStatusLabel[status]}
        </div>
      ))}
    </div>
  ),
};

export const Priorities: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      {issuePriorities.map((priority) => (
        <div key={priority} className="flex items-center gap-2 text-sm text-fg">
          <PriorityIcon priority={priority} label="" />
          {issuePriorityLabel[priority]}
        </div>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <StatusIcon status="in_review" className="size-3" />
      <StatusIcon status="in_review" />
      <StatusIcon status="in_review" className="size-5" />
      <PriorityIcon priority="high" className="size-3.5" />
      <PriorityIcon priority="high" />
      <PriorityIcon priority="high" className="size-5" />
    </div>
  ),
};

export const InContext: Story = {
  render: () => (
    <div className="flex w-[480px] flex-col rounded-lg border border-line">
      {(
        [
          {
            id: "ENG-412",
            title: "Sync stalls when the device goes offline mid-upload",
            status: "in_progress",
            priority: "urgent",
          },
          {
            id: "ENG-398",
            title: "Keyboard shortcut for moving issues between cycles",
            status: "in_review",
            priority: "medium",
          },
          {
            id: "ENG-377",
            title: "Remove legacy webhooks v1 endpoints",
            status: "backlog",
            priority: "low",
          },
          {
            id: "ENG-350",
            title: "Dark mode contrast on the roadmap timeline",
            status: "done",
            priority: "high",
          },
        ] as const
      ).map((issue) => (
        <div
          key={issue.id}
          className="flex h-10 items-center gap-3 border-b border-line px-3 text-sm last:border-b-0"
        >
          <PriorityIcon priority={issue.priority} />
          <span className="w-16 text-fg-muted tabular-nums">{issue.id}</span>
          <StatusIcon status={issue.status} />
          <span className="truncate text-fg">{issue.title}</span>
        </div>
      ))}
    </div>
  ),
};
