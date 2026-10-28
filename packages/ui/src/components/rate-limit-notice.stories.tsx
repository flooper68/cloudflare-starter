import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { RateLimitNotice } from "./rate-limit-notice";

/**
 * What a form shows when the server answers 429: how long to wait (from Retry-After),
 * counting down, then "Try again". Used on the sign-in, sign-up and forgot-password forms.
 */
const meta = {
  title: "Feedback/RateLimitNotice",
  component: RateLimitNotice,
  tags: ["autodocs"],
  args: {
    retryAfterSeconds: 42,
    subject: "sign-in attempts",
    onRetry: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RateLimitNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Interaction test: the countdown runs out, then "Try again" calls onRetry. */
export const CountdownThenRetry: Story = {
  args: { retryAfterSeconds: 2 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Try again in 0:02.")).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "Try again" })
    ).toBeNull();
    const retry = await canvas.findByRole(
      "button",
      { name: "Try again" },
      { timeout: 4000 }
    );
    await expect(canvas.getByText("You can try again now.")).toBeVisible();
    await userEvent.click(retry);
    await expect(args.onRetry).toHaveBeenCalledOnce();
  },
};

/** Long waits read as minutes. */
export const LongWait: Story = {
  args: { retryAfterSeconds: 3600, subject: "app registrations" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Try again in 60:00.")
    ).toBeVisible();
  },
};

/** The retry is running. */
export const Retrying: Story = {
  args: { retryAfterSeconds: 0, retrying: true },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", {
      name: "Try again",
    });
    await waitFor(() => expect(button).toHaveAttribute("aria-busy", "true"));
  },
};

/** The retry failed for another reason. */
export const RetryFailed: Story = {
  args: {
    retryAfterSeconds: 0,
    error: "We could not check that you are human. Try again.",
  },
};

/** In the forgot-password card, where three requests a minute are allowed. */
export const InContext: Story = {
  args: { retryAfterSeconds: 37, subject: "reset requests" },
  render: (args) => (
    <Card>
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
      </CardHeader>
      <CardContent>
        <RateLimitNotice {...args} />
      </CardContent>
    </Card>
  ),
};
