import { BellOff, CheckCheck } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../lib/utils";
import { Button } from "../button";
import { DataState, type DataStatus } from "../data-state";
import { EmptyState } from "../empty-state";
import { SegmentedControl, SegmentedControlItem } from "../segmented-control";
import {
  type NotificationItem,
  NotificationList,
  NotificationListSkeleton,
} from "./notification-list";

/** Which part of the inbox is shown. */
export type NotificationView = "inbox" | "unread" | "archived";

export interface NotificationInboxProps {
  readonly status: DataStatus;
  readonly items: readonly NotificationItem[] | undefined;
  readonly error?: unknown;
  readonly onRetry?: () => unknown;
  readonly view: NotificationView;
  readonly onViewChange: (view: NotificationView) => void;
  readonly onOpen?: (item: NotificationItem) => void;
  readonly onMarkRead?: (id: string) => void;
  readonly onArchive?: (id: string) => void;
  /** Marks everything read; hidden when nothing is unread. */
  readonly onMarkAllRead?: () => void;
  readonly unreadCount: number;
  /** More pages exist: shows "Load more". */
  readonly hasMore?: boolean;
  readonly onLoadMore?: () => void;
  /** Links under the list ("View all", "Settings"). */
  readonly footer?: ReactNode;
  /** `popover`: compact, scrolls inside a fixed height; `page`: full width. */
  readonly variant?: "popover" | "page";
  readonly now?: Date;
}

const EMPTY: Record<NotificationView, { title: string; description: string }> =
  {
    inbox: {
      title: "You're all caught up",
      description:
        "Notifications about your workspaces and your account show up here.",
    },
    unread: {
      title: "Nothing unread",
      description: "New notifications show up here until you read them.",
    },
    archived: {
      title: "Nothing archived",
      description: "Archive a notification to keep your inbox short.",
    },
  };

/**
 * The notification inbox: a view switch (Inbox, Unread, Archived), "Mark all read", and
 * the list with its loading, empty and error states. The bell's popover and the inbox
 * page both render it.
 */
export function NotificationInbox({
  status,
  items,
  error,
  onRetry,
  view,
  onViewChange,
  onOpen,
  onMarkRead,
  onArchive,
  onMarkAllRead,
  unreadCount,
  hasMore,
  onLoadMore,
  footer,
  variant = "page",
  now,
}: NotificationInboxProps) {
  const popover = variant === "popover";
  return (
    <section aria-label="Notification inbox" className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <SegmentedControl
          size="sm"
          aria-label="Show"
          value={view}
          onValueChange={(next) => onViewChange(next as NotificationView)}
        >
          <SegmentedControlItem value="inbox">Inbox</SegmentedControlItem>
          <SegmentedControlItem value="unread">Unread</SegmentedControlItem>
          <SegmentedControlItem value="archived">Archived</SegmentedControlItem>
        </SegmentedControl>
        {onMarkAllRead && unreadCount > 0 && view !== "archived" ? (
          <Button
            size="sm"
            variant="ghost"
            icon={<CheckCheck />}
            onClick={onMarkAllRead}
          >
            Mark all read
          </Button>
        ) : null}
      </div>
      <div className={cn(popover && "max-h-96 overflow-y-auto")}>
        <DataState
          status={status}
          data={items}
          error={error}
          onRetry={onRetry}
          isEmpty={(value) => value.length === 0}
          loading={<NotificationListSkeleton rows={popover ? 3 : 5} />}
          empty={
            <EmptyState
              variant="compact"
              icon={<BellOff />}
              title={EMPTY[view].title}
              description={EMPTY[view].description}
            />
          }
        >
          {(value) => (
            <>
              <NotificationList
                items={value}
                onOpen={onOpen}
                onMarkRead={onMarkRead}
                onArchive={view === "archived" ? undefined : onArchive}
                now={now}
              />
              {hasMore && onLoadMore ? (
                <div className="flex justify-center border-t border-line p-2">
                  <Button size="sm" variant="ghost" onClick={onLoadMore}>
                    Load more
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </DataState>
      </div>
      {footer ? (
        <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2 text-xs">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
