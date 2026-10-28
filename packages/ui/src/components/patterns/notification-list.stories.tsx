import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { Card } from "../card";
import { NOW, notificationItems } from "./notification-fixtures";
import {
  NotificationList,
  NotificationListSkeleton,
  relativeTime,
} from "./notification-list";

/**
 * Notifications, newest first: unread entries have a dot and a raised background, titles
 * link where the entry leads, and each row has "Mark read" (unread only) and "Archive".
 */
const meta = {
  title: "Patterns/NotificationList",
  component: NotificationList,
  tags: ["autodocs"],
  args: {
    items: notificationItems,
    now: NOW,
    onOpen: fn(),
    onMarkRead: fn(),
    onArchive: fn(),
  },
  render: (args) => (
    <Card className="w-[420px] p-0">
      <NotificationList {...args} />
    </Card>
  ),
} satisfies Meta<typeof NotificationList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** All read: no dots, no "Mark read" buttons. */
export const AllRead: Story = {
  args: {
    items: notificationItems.map((item) => ({ ...item, read: true })),
  },
};

/** Loading: rows shaped like notifications. */
export const Loading: Story = {
  render: () => (
    <Card className="w-[420px] p-0">
      <NotificationListSkeleton />
    </Card>
  ),
};

/** Opening an entry, marking one read and archiving one report the entry. */
export const OpenMarkReadArchive: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("Unread:")).toHaveLength(2);
    await userEvent.click(
      canvas.getByRole("link", { name: /Grace Hopper joined/ })
    );
    await expect(args.onOpen).toHaveBeenCalledWith(notificationItems[0]);
    await userEvent.click(
      canvas.getByRole("button", {
        name: "Mark read: New sign-in to your account",
      })
    );
    await expect(args.onMarkRead).toHaveBeenCalledWith("n-2");
    await expect(
      canvas.queryByRole("button", {
        name: "Mark read: Your password was changed",
      })
    ).toBeNull();
    await userEvent.click(
      canvas.getByRole("button", { name: "Archive: Your password was changed" })
    );
    await expect(args.onArchive).toHaveBeenCalledWith("n-4");
    await expect(relativeTime("2026-10-28T11:56:00.000Z", NOW)).toBe("4m ago");
  },
};
