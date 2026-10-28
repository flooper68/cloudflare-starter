import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { Card } from "../card";
import { preferencesData } from "./notification-fixtures";
import { NotificationPreferences } from "./notification-preferences";

/**
 * Which notifications arrive where: a switch per type and channel, security notices
 * locked on, and the email cadence. Switches apply at once.
 */
const meta = {
  title: "Patterns/NotificationPreferences",
  component: NotificationPreferences,
  tags: ["autodocs"],
  args: {
    status: "success",
    data: preferencesData,
    onToggle: fn(),
    onCadenceChange: fn(),
    onRetry: fn(),
  },
  render: (args) => (
    <Card className="w-[640px] p-0">
      <NotificationPreferences {...args} />
    </Card>
  ),
} satisfies Meta<typeof NotificationPreferences>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Content. */
export const Content: Story = {};

/** Loading. */
export const Loading: Story = { args: { status: "pending", data: undefined } };

/** No notification types. */
export const Empty: Story = {
  args: { data: { ...preferencesData, types: [] } },
};

/** Failed to load, with retry. */
export const ErrorState: Story = {
  args: {
    status: "error",
    data: undefined,
    error: new Error("The server didn't answer. Check your connection."),
  },
};

/** The deployment sends no email: the email column is off and says why. */
export const EmailNotSetUp: Story = {
  args: { data: { ...preferencesData, emailAvailable: false } },
};

/** Switches report type, channel and value; security rows cannot change. */
export const ToggleAndCadence: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("switch", {
        name: "Someone joins a workspace you manage: email",
      })
    );
    await expect(args.onToggle).toHaveBeenCalledWith(
      "workspaces.member-joined",
      "email",
      false
    );
    await expect(
      canvas.getByRole("switch", { name: "Your password changes: email" })
    ).toBeDisabled();
    await expect(canvas.getAllByText("Security, always on")).toHaveLength(2);
    await userEvent.click(canvas.getByRole("radio", { name: "Daily digest" }));
    await expect(args.onCadenceChange).toHaveBeenCalledWith("daily");
  },
};
