import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { Button } from "../button";
import {
  type ChecklistStep,
  GettingStartedChecklist,
  GettingStartedChecklistSkeleton,
} from "./getting-started-checklist";

const link = (href: string, label: string) => (
  <Button asChild size="sm">
    <a href={href}>{label}</a>
  </Button>
);

const steps: ChecklistStep[] = [
  {
    id: "verify-email",
    title: "Verify your email",
    description: "Confirms the address password resets and notices go to.",
    done: true,
  },
  {
    id: "invite",
    title: "Invite a teammate",
    description: "Workspaces are shared: files, notes and the trash.",
    done: false,
    action: link("/app/members", "Invite"),
  },
  {
    id: "two-factor",
    title: "Turn on two-factor authentication",
    description: "An authenticator app or a passkey protects the account.",
    done: false,
    action: link("/app/settings/security", "Set up"),
  },
  {
    id: "note",
    title: "Write your first note",
    description: "The placeholder Notes app shows a full feature end to end.",
    done: false,
    action: link("/app/notes", "New note"),
  },
];

/**
 * The dashboard's getting-started card: what is left to set up, each step with its
 * action, and how many are done.
 */
const meta = {
  title: "Patterns/GettingStartedChecklist",
  component: GettingStartedChecklist,
  tags: ["autodocs"],
  args: {
    steps,
    description: "A few steps to see every part of the starter working.",
  },
} satisfies Meta<typeof GettingStartedChecklist>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Some steps done. */
export const InProgress: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("1 of 4 done")).toBeVisible();
    // A done step offers no action; an open one does.
    await expect(canvas.getByText("Verify your email")).toHaveTextContent(
      "(done)"
    );
    await expect(canvas.getByRole("link", { name: "Invite" })).toHaveAttribute(
      "href",
      "/app/members"
    );
  },
};

/** Everything done. */
export const AllDone: Story = {
  args: { steps: steps.map((step) => ({ ...step, done: true })) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("4 of 4 done")).toBeVisible();
    await expect(canvas.queryAllByRole("link")).toHaveLength(0);
  },
};

/** While the steps' state loads. */
export const Loading: Story = {
  render: () => <GettingStartedChecklistSkeleton />,
};
