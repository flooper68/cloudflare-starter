import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { OfflineNotice } from "./offline-notice";

/**
 * Shown at the top of the app shell while the browser reports it is offline or the
 * app's requests cannot reach the server.
 */
const meta = {
  title: "Feedback/OfflineNotice",
  component: OfflineNotice,
  tags: ["autodocs"],
  args: { onRetry: fn() },
} satisfies Meta<typeof OfflineNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The notice with a way to check again. */
export const Offline: Story = {};

/** While the check runs. */
export const Retrying: Story = { args: { retrying: true } };

/** Without a retry: the notice waits for the browser's "online" event. */
export const WithoutRetry: Story = { args: { onRetry: undefined } };

/** "Try again" asks the page to check the connection. */
export const TryAgainChecks: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "You're offline."
    );
    await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
    await expect(args.onRetry).toHaveBeenCalled();
  },
};
