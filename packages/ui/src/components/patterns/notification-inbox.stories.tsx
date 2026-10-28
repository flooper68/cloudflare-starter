import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { Button } from "../button";
import { Card } from "../card";
import { NotificationBell } from "./notification-bell";
import { NOW, notificationItems } from "./notification-fixtures";
import { NotificationInbox, type NotificationView } from "./notification-inbox";
import type { NotificationItem } from "./notification-list";

/**
 * The inbox with its view switch and "Mark all read", in the four data states. The bell's
 * popover (`variant="popover"`) and the inbox page (`variant="page"`) render it.
 */
const meta = {
  title: "Patterns/NotificationInbox",
  component: NotificationInbox,
  tags: ["autodocs"],
  args: {
    status: "success",
    items: notificationItems,
    view: "inbox",
    unreadCount: 2,
    now: NOW,
    onViewChange: fn(),
    onMarkRead: fn(),
    onArchive: fn(),
    onMarkAllRead: fn(),
    onOpen: fn(),
    onRetry: fn(),
  },
  render: (args) => (
    <Card className="w-[440px] p-0">
      <NotificationInbox {...args} />
    </Card>
  ),
} satisfies Meta<typeof NotificationInbox>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Content. */
export const Content: Story = {};

/** Loading. */
export const Loading: Story = { args: { status: "pending", items: undefined } };

/** Empty inbox. */
export const Empty: Story = { args: { items: [], unreadCount: 0 } };

/** Failed to load, with retry. */
export const ErrorState: Story = {
  args: {
    status: "error",
    items: undefined,
    error: new Error("The server didn't answer. Check your connection."),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: /try again/i })
    );
    await expect(args.onRetry).toHaveBeenCalled();
  },
};

/** More pages: "Load more" under the list. */
export const WithMore: Story = { args: { hasMore: true, onLoadMore: fn() } };

/** A working inbox: switching views filters, "Mark all read" clears the dots. */
function LiveInbox() {
  const [items, setItems] = useState<NotificationItem[]>(notificationItems);
  const [view, setView] = useState<NotificationView>("inbox");
  const shown = items.filter((item) =>
    view === "archived"
      ? item.archived
      : !item.archived && (view === "inbox" || !item.read)
  );
  const unread = items.filter((item) => !item.read && !item.archived).length;
  return (
    <Card className="w-[440px] p-0">
      <NotificationInbox
        status="success"
        items={shown}
        view={view}
        onViewChange={setView}
        unreadCount={unread}
        now={NOW}
        onMarkRead={(id) =>
          setItems((all) =>
            all.map((item) => (item.id === id ? { ...item, read: true } : item))
          )
        }
        onArchive={(id) =>
          setItems((all) =>
            all.map((item) =>
              item.id === id ? { ...item, archived: true, read: true } : item
            )
          )
        }
        onMarkAllRead={() =>
          setItems((all) => all.map((item) => ({ ...item, read: true })))
        }
        footer={
          <>
            <a className="text-accent-text hover:underline" href="#all">
              View all
            </a>
            <a className="text-accent-text hover:underline" href="#settings">
              Settings
            </a>
          </>
        }
      />
    </Card>
  );
}

/** Views, archive and "Mark all read" working together. */
export const ViewsAndMarkAllRead: Story = {
  render: () => <LiveInbox />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("radio", { name: "Unread" }));
    await expect(canvas.getAllByRole("listitem")).toHaveLength(2);
    await userEvent.click(canvas.getByRole("radio", { name: "Inbox" }));
    await userEvent.click(
      canvas.getByRole("button", { name: "Archive: Your password was changed" })
    );
    await expect(canvas.getAllByRole("listitem")).toHaveLength(3);
    await userEvent.click(
      canvas.getByRole("button", { name: "Mark all read" })
    );
    await expect(canvas.queryByText("Unread:")).toBeNull();
    await expect(
      canvas.queryByRole("button", { name: "Mark all read" })
    ).toBeNull();
    await userEvent.click(canvas.getByRole("radio", { name: "Archived" }));
    await expect(canvas.getAllByRole("listitem")).toHaveLength(1);
  },
};

/** The bell in a top bar with its popover open. */
export const BellOpen: Story = {
  render: (args) => (
    <div className="flex h-[520px] w-[520px] justify-end p-2">
      <NotificationBell unreadCount={2} defaultOpen>
        <NotificationInbox {...args} variant="popover" />
      </NotificationBell>
    </div>
  ),
};

/** The badge: nothing at 0, the count, "99+" above 99; the name says how many. */
export const BellBadge: Story = {
  render: () => (
    <div className="flex gap-4 p-2">
      <NotificationBell unreadCount={0}>
        <p className="p-3 text-sm text-fg">Nothing new</p>
      </NotificationBell>
      <NotificationBell unreadCount={3}>
        <p className="p-3 text-sm text-fg">3 unread</p>
      </NotificationBell>
      <NotificationBell unreadCount={120}>
        <p className="p-3 text-sm text-fg">Lots</p>
      </NotificationBell>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: "Notifications" })
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Notifications, 3 unread" })
    ).toHaveTextContent("3");
    await expect(
      canvas.getByRole("button", { name: "Notifications, 99+ unread" })
    ).toHaveTextContent("99+");
  },
};

/** Clicking the bell opens the inbox; Escape closes it. */
export const BellOpensInbox: Story = {
  render: (args) => (
    <div className="flex h-[520px] w-[520px] justify-end p-2">
      <NotificationBell unreadCount={2}>
        <NotificationInbox
          {...args}
          variant="popover"
          footer={
            <Button size="sm" variant="link">
              View all
            </Button>
          }
        />
      </NotificationBell>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("button", { name: "Notifications, 2 unread" })
    );
    const panel = await page.findByRole("dialog", { name: "Notifications" });
    await waitFor(() =>
      expect(
        within(panel).getByRole("link", { name: /Grace Hopper joined/ })
      ).toBeVisible()
    );
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
  },
};
