import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Bell,
  Bot,
  CreditCard,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { expect, within } from "storybook/test";

import { type Feature, FeatureGrid } from "./feature-grid";

const features: Feature[] = [
  {
    icon: <ShieldCheck />,
    title: "Auth and account security",
    description:
      "Email and password or Google, passkeys, authenticator two-factor with recovery codes, email verification.",
  },
  {
    icon: <Users />,
    title: "Workspaces and roles",
    description:
      "Personal, single or multi-workspace mode; open or invite-only sign-up; invitations by email.",
  },
  {
    icon: <CreditCard />,
    title: "Plans and limits",
    description:
      "A plan catalog in code, trials, usage meters and upgrade prompts where a limit stops someone.",
  },
  {
    icon: <Bot />,
    title: "MCP server with OAuth",
    description:
      "Claude signs in as the user at /mcp; a test fails the build if an API has no tool.",
  },
  {
    icon: <Bell />,
    title: "Notifications",
    description:
      "An inbox with an unread badge, email at once or as a daily digest, one-click unsubscribe.",
  },
  {
    icon: <Trash2 />,
    title: "Files on R2, with a trash",
    description:
      "Uploads through the Worker or presigned URLs; deleted files restore for 30 days.",
  },
];

const steps: Feature[] = [
  {
    title: "Update and pin every dependency",
    description:
      "The pins are only as fresh as the starter's last change; bunfig.toml keeps new ones exact.",
  },
  {
    title: "Choose how users are grouped",
    description:
      "WORKSPACE_MODE, SIGN_UP and BILLING per environment; a deploy refuses to start until you have chosen.",
  },
  {
    title: "Strip what the product does not use",
    description:
      "Containers, Storybook, jobs, cron, files, email, notifications: each has a removal list.",
  },
];

/**
 * A titled grid of cards: features with icons, or `numbered` steps as an ordered list.
 * One column on phones.
 */
const meta = {
  title: "Patterns/FeatureGrid",
  component: FeatureGrid,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    title: "What's in the box",
    description:
      "Every feature is a demo of a pattern, with tests at every layer and a guide in the docs.",
    features,
  },
  argTypes: { features: { control: false } },
} satisfies Meta<typeof FeatureGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Steps in order: 01, 02, 03 instead of icons. */
export const NumberedSteps: Story = {
  args: {
    title: "Start a project in three steps",
    description: undefined,
    features: steps,
    numbered: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole("list");
    await expect(list.tagName).toBe("OL");
    await expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    await expect(canvas.getByText("01")).toBeInTheDocument();
  },
};

/** The section is named by its heading. */
export const Labelled: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("region", { name: "What's in the box" })
    ).toBeInTheDocument();
    await expect(canvas.getAllByRole("heading", { level: 3 })).toHaveLength(6);
  },
};

/** On a phone the cards stack in one column. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[360px]">
        <Story />
      </div>
    ),
  ],
};
