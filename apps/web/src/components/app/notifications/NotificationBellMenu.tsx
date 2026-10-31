import {
  NotificationBell,
  NotificationInbox,
  type NotificationItem,
  type NotificationView,
} from "@cloudflare-starter/ui";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { notificationDestination } from "@/lib/notification-navigation";

import { useInbox, useUnreadCount } from "./use-notifications";

/** The open popover's inbox: loaded only while it is open. */
function BellInbox({
  unreadCount,
  onChange,
  onClose,
}: {
  readonly unreadCount: number;
  readonly onChange: () => unknown;
  readonly onClose: () => void;
}) {
  const navigate = useNavigate();
  const [view, setView] = useState<NotificationView>("inbox");
  const inbox = useInbox(view, { limit: 10, onChange });

  function open(item: NotificationItem) {
    if (!item.read) void inbox.markRead([item.id]);
    onClose();
    const destination = notificationDestination(
      item.href,
      window.location.href
    );
    if (!destination) return;
    if (destination.kind === "spa") void navigate({ to: destination.href });
    else window.location.assign(destination.href);
  }

  return (
    <NotificationInbox
      variant="popover"
      status={inbox.data.status}
      items={inbox.data.data?.items}
      error={inbox.data.error}
      onRetry={inbox.data.refetch}
      view={view}
      onViewChange={setView}
      unreadCount={unreadCount}
      onOpen={open}
      onMarkRead={(id) => void inbox.markRead([id])}
      onArchive={(id) => void inbox.archive([id])}
      onMarkAllRead={() => void inbox.markAllRead()}
      footer={
        <>
          <Link
            to="/app/notifications"
            onClick={onClose}
            className="text-accent-text hover:underline"
          >
            View all
          </Link>
          <Link
            to="/app/notifications/preferences"
            onClick={onClose}
            className="text-accent-text hover:underline"
          >
            Settings
          </Link>
        </>
      }
    />
  );
}

/** The bell in the app's top bar: unread badge, popover inbox. */
export function NotificationBellMenu() {
  const unread = useUnreadCount();
  const [open, setOpen] = useState(false);
  return (
    <NotificationBell
      unreadCount={unread.count}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void unread.refresh();
      }}
    >
      {open ? (
        <BellInbox
          unreadCount={unread.count}
          onChange={unread.refresh}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </NotificationBell>
  );
}
