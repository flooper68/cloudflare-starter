import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { UnsubscribeCard } from "./unsubscribe-card";

/**
 * The page a notification mail's unsubscribe link opens. Opening it changes nothing (mail
 * scanners open links); the button unsubscribes.
 */
const meta = {
  title: "Patterns/UnsubscribeCard",
  component: UnsubscribeCard,
  tags: ["autodocs"],
  args: {
    state: "confirm",
    topic: "Someone joins a workspace you manage",
    onConfirm: fn(async () => {}),
  },
} satisfies Meta<typeof UnsubscribeCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A valid link: confirm. */
export const Confirm: Story = {};

/** A digest's link: all notification mail. */
export const AllMail: Story = { args: { topic: null } };

/** Done. */
export const Done: Story = { args: { state: "done" } };

/** A malformed or tampered link. */
export const Invalid: Story = { args: { state: "invalid", topic: undefined } };

/** Confirming unsubscribes and shows the result. */
export const ConfirmUnsubscribes: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Unsubscribe" }));
    await expect(args.onConfirm).toHaveBeenCalled();
    await expect(await canvas.findByText("You are unsubscribed")).toBeVisible();
  },
};

/** A failed request shows its message and keeps the button. */
export const ConfirmFails: Story = {
  args: {
    onConfirm: fn(async () => {
      throw new Error("Too many requests. Try again in a minute.");
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Unsubscribe" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Too many requests"
    );
  },
};
