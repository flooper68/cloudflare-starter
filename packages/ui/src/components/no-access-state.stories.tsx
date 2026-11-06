import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { Button } from "./button";
import { Card } from "./card";
import { NoAccessState } from "./no-access-state";

/**
 * The 403 view: the user's role may not open this page or data. It names who can grant
 * access, so the user knows whom to ask, and offers a way back.
 */
const meta = {
  title: "Feedback/NoAccessState",
  component: NoAccessState,
  tags: ["autodocs"],
  args: {
    reason: "Workspace settings are for workspace owners.",
    grantedBy: ["Ada Lovelace"],
    workspaceName: "Analytical Engines",
    action: (
      <Button asChild variant="secondary">
        <a href="/app/dashboard">Back to dashboard</a>
      </Button>
    ),
  },
} satisfies Meta<typeof NoAccessState>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An owner-only page reached by a member. */
export const OwnerOnlyPage: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("region", { name: "No access" })
    ).toHaveTextContent(
      "Ask Ada Lovelace, the owner of Analytical Engines, if you need it."
    );
  },
};

/** Several owners: each is named. */
export const SeveralOwners: Story = {
  args: { grantedBy: ["Ada Lovelace", "Grace Hopper", "Alan Turing"] },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("region", { name: "No access" })
    ).toHaveTextContent("Ask Ada Lovelace, Grace Hopper or Alan Turing");
  },
};

/** The owners are unknown (their list failed to load): ask "an owner". */
export const OwnersUnknown: Story = {
  args: { grantedBy: [], reason: undefined },
};

/** Inside a card, for a data view whose request answered FORBIDDEN. */
export const InCard: Story = {
  args: { variant: "compact", action: undefined },
  render: (args) => (
    <Card className="max-w-lg">
      <NoAccessState {...args} />
    </Card>
  ),
};
