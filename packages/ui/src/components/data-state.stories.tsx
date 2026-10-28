import type { Meta, StoryObj } from "@storybook/react-vite";
import { Inbox, Plus } from "lucide-react";

import { Button } from "./button";
import { Card } from "./card";
import { DataState, type DataStatus } from "./data-state";
import { EmptyState } from "./empty-state";
import { SkeletonListRow } from "./skeleton";

/**
 * Loading → skeleton, error → ErrorState, empty → EmptyState, otherwise the content. Every
 * view that loads data goes through this (or handles the same four states itself).
 */
interface Args {
  readonly status: string;
}

const meta = {
  title: "Feedback/DataState",
  parameters: { layout: "centered" },
  argTypes: {
    status: {
      control: "inline-radio",
      options: ["pending", "error", "success-empty", "success"],
    },
  },
  args: { status: "success" },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

const issues = [
  { id: "ENG-142", title: "Sign-in link expires before the email arrives" },
  { id: "ENG-155", title: "Filter issues by assignee and label" },
  { id: "ENG-160", title: "Rate-limit the MCP token endpoint" },
];

export const AllStates: Story = {
  render: ({ status }) => {
    const queryStatus: DataStatus =
      status === "success-empty" ? "success" : (status as DataStatus);
    const data = status === "success-empty" ? [] : issues;
    return (
      <Card className="w-[420px] p-0">
        <div className="border-b border-line px-4 py-3 text-sm font-medium">
          My issues
        </div>
        <DataState
          status={queryStatus}
          data={queryStatus === "success" ? data : undefined}
          error={new Error("The server didn't answer.")}
          onRetry={() => new Promise((resolve) => setTimeout(resolve, 800))}
          loading={
            <div className="py-1">
              <SkeletonListRow />
              <SkeletonListRow />
              <SkeletonListRow />
            </div>
          }
          empty={
            <EmptyState
              variant="compact"
              icon={<Inbox />}
              title="No issues assigned to you"
              description="Issues you're assigned show up here."
              primaryAction={
                <Button size="sm" variant="primary" icon={<Plus />}>
                  New issue
                </Button>
              }
            />
          }
        >
          {(items) => (
            <ul className="py-1">
              {items.map((issue) => (
                <li
                  key={issue.id}
                  className="flex h-9 items-center gap-3 px-4 text-sm hover:bg-hover"
                >
                  <span className="font-mono text-xs text-fg-subtle">
                    {issue.id}
                  </span>
                  <span className="truncate">{issue.title}</span>
                </li>
              ))}
            </ul>
          )}
        </DataState>
      </Card>
    );
  },
};

export const Loading: Story = { ...AllStates, args: { status: "pending" } };
export const Failed: Story = { ...AllStates, args: { status: "error" } };
export const Empty: Story = { ...AllStates, args: { status: "success-empty" } };
