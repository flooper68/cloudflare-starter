import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { ImpersonationBanner } from "./impersonation-banner";

/** Shown across the top of the app while an admin impersonates a user. */
const meta = {
  title: "Patterns/Admin/ImpersonationBanner",
  component: ImpersonationBanner,
  tags: ["autodocs"],
  args: {
    userName: "Grace Hopper",
    userEmail: "grace@acme.test",
    onStop: fn(async () => {}),
  },
  render: (args) => (
    <div className="w-[880px]">
      <ImpersonationBanner {...args} />
    </div>
  ),
} satisfies Meta<typeof ImpersonationBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The banner. */
export const Default: Story = {};

/** "Stop impersonating" reports the intent. */
export const Stop: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Stop impersonating" })
    );
    await waitFor(() => expect(args.onStop).toHaveBeenCalled());
  },
};
