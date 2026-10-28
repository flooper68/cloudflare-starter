import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { Button } from "./button";
import { Card } from "./card";
import { ErrorState } from "./error-state";

/**
 * Failure, explained: what happened and a way forward. Pair with Skeleton (loading) and
 * EmptyState (nothing to show); `DataState` picks between all four.
 */
const meta = {
  title: "Feedback/ErrorState",
  component: ErrorState,
  tags: ["autodocs"],
  args: {
    variant: "page",
    title: "Couldn't load issues",
    description:
      "The server didn't answer. Check your connection and try again.",
    onRetry: () => new Promise((resolve) => setTimeout(resolve, 1200)),
  },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["page", "compact", "inline"],
    },
  },
} satisfies Meta<typeof ErrorState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Page: Story = {
  args: {
    secondaryAction: (
      <Button variant="ghost" size="sm">
        Go to dashboard
      </Button>
    ),
    details: "GET /api/trpc/issues.list → 503 · request id 7f3c2a1e",
  },
};

export const InACard: Story = {
  render: () => (
    <Card className="w-96 p-0">
      <div className="border-b border-line px-4 py-3 text-sm font-medium">
        Cycle burndown
      </div>
      <ErrorState
        variant="compact"
        title="Chart unavailable"
        description="Cycle data is still being calculated."
        onRetry={() => new Promise((resolve) => setTimeout(resolve, 800))}
      />
    </Card>
  ),
};

export const Inline: Story = {
  render: () => (
    <div className="w-96">
      <ErrorState
        variant="inline"
        description="Couldn't save the title."
        onRetry={() => new Promise((resolve) => setTimeout(resolve, 800))}
      />
    </div>
  ),
};

/** An unexpected server error: the reference (request id) is what the user quotes to support. */
export const WithReference: Story = {
  args: {
    title: "Couldn't queue the message",
    description: "Something went wrong on our side. Try again in a moment.",
    reference: "3f6c1d2e-8b4a-4f0e-9c7d-5a1b2c3d4e5f",
  },
  play: async ({ canvasElement }) => {
    const alert = within(canvasElement).getByRole("alert");
    await expect(alert).toHaveTextContent(
      "Reference 3f6c1d2e-8b4a-4f0e-9c7d-5a1b2c3d4e5f"
    );
  },
};

export const InlineWithReference: Story = {
  render: () => (
    <div className="w-96">
      <ErrorState
        variant="inline"
        description="Internal error"
        reference="3f6c1d2e-8b4a-4f0e-9c7d-5a1b2c3d4e5f"
        onRetry={() => new Promise((resolve) => setTimeout(resolve, 800))}
      />
    </div>
  ),
};

export const FromAnError: Story = {
  args: {
    description: undefined,
    error: new Error("You don't have access to this project."),
    title: "No access",
    onRetry: undefined,
  },
};
