import {
  Button,
  Card,
  NotificationInbox,
  type NotificationItem,
  type NotificationView,
} from "@cloudflare-starter/ui";
import { Link, useNavigate } from "@tanstack/react-router";
import { Settings2 } from "lucide-react";
import { useState } from "react";
import {
  useInbox,
  useUnreadCount,
} from "@/components/app/notifications/use-notifications";
import { notificationDestination } from "@/lib/notification-navigation";

/** `/app/notifications`: the full inbox, with views, paging and the actions. */
export function NotificationsPage() {
  const navigate = useNavigate();
  const unread = useUnreadCount();
  const [view, setView] = useState<NotificationView>("inbox");
  const inbox = useInbox(view, { limit: 25, onChange: unread.refresh });

  function open(item: NotificationItem) {
    if (!item.read) void inbox.markRead([item.id]);
    const destination = notificationDestination(
      item.href,
      window.location.href
    );
    if (!destination) return;
    if (destination.kind === "spa") void navigate({ to: destination.href });
    else window.location.assign(destination.href);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold text-fg">Notifications</h2>
          <p className="max-w-3xl text-sm leading-6 text-fg-muted">
            What happened in your workspaces and on your account. Read and
            archived notifications are kept for 90 days, unread ones for a year.
          </p>
        </div>
        <Button asChild variant="secondary" icon={<Settings2 />}>
          <Link to="/app/notifications/preferences">Settings</Link>
        </Button>
      </div>
      <Card className="p-0">
        <NotificationInbox
          status={inbox.data.status}
          items={inbox.data.data?.items}
          error={inbox.data.error}
          onRetry={inbox.data.refetch}
          view={view}
          onViewChange={setView}
          unreadCount={unread.count}
          hasMore={inbox.data.data?.hasMore}
          onLoadMore={inbox.loadMore}
          onOpen={open}
          onMarkRead={(id) => void inbox.markRead([id])}
          onArchive={(id) => void inbox.archive([id])}
          onMarkAllRead={() => void inbox.markAllRead()}
        />
      </Card>
    </section>
  );
}
