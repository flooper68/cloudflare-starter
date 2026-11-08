import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { DemoBanner } from "./demo-banner";

/** The demo instance's notice: across the app's pages and above the sign-up form. */
const meta = {
  title: "Patterns/Demo/DemoBanner",
  component: DemoBanner,
  tags: ["autodocs"],
  args: {
    retentionDays: 7,
    repositoryUrl: "https://github.com/flooper68/cloudflare-starter",
    onDismiss: fn(),
  },
  render: (args) => (
    <div className="w-[880px]">
      <DemoBanner {...args} />
    </div>
  ),
} satisfies Meta<typeof DemoBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** In the app: the notice, the GitHub link and the dismiss button. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(/your account and data are deleted after 7 days/)
    ).toBeVisible();
    const link = canvas.getByRole("link", {
      name: /Get the starter on GitHub/,
    });
    await expect(link).toHaveAttribute(
      "href",
      "https://github.com/flooper68/cloudflare-starter"
    );
    await expect(link).toHaveAttribute("target", "_blank");
  },
};

/** The × reports the dismissal. */
export const Dismiss: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Dismiss" })
    );
    await expect(args.onDismiss).toHaveBeenCalled();
  },
};

/** On the sign-up page: no dismiss button. */
export const SignUp: Story = {
  args: { onDismiss: undefined },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByRole("button", { name: "Dismiss" })
    ).toBeNull();
  },
};
