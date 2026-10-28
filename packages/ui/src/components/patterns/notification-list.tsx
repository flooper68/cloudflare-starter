import { Archive, Check } from "lucide-react";
import type { MouseEvent } from "react";

import { cn } from "../../lib/utils";
import { IconButton } from "../button";
import { Skeleton } from "../skeleton";

/** One notification as the inbox shows it. */
export interface NotificationItem {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  /** An app path the entry opens, or null. */
  readonly href: string | null;
  /** ISO time it arrived. */
  readonly createdAt: string;
  readonly read: boolean;
  readonly archived?: boolean;
}

export interface NotificationListProps {
  readonly items: readonly NotificationItem[];
  /** Opening an entry (click on its title); the caller marks it read and navigates. */
  readonly onOpen?: (item: NotificationItem) => void;
  readonly onMarkRead?: (id: string) => void;
  readonly onArchive?: (id: string) => void;
  /** "Now" for relative times; stories pass a fixed one. */
  readonly now?: Date;
  readonly className?: string;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "5m ago", "3h ago", "2d ago", else the date. */
export function relativeTime(iso: string, now: Date): string {
  const then = new Date(iso);
  const elapsed = now.getTime() - then.getTime();
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}d ago`;
  return then.toLocaleDateString("en", { month: "short", day: "numeric" });
}

/**
 * A list of notifications, newest first: an unread dot, the title (a link when the entry
 * has one), the body and when it arrived, with "Mark read" and "Archive" buttons. Used in
 * the bell's popover and on the inbox page; wrap it in `DataState` for loading, empty and
 * error.
 */
export function NotificationList({
  items,
  onOpen,
  onMarkRead,
  onArchive,
  now = new Date(),
  className,
}: NotificationListProps) {
  return (
    <ul
      aria-label="Notifications"
      className={cn("divide-y divide-line", className)}
    >
      {items.map((item) => {
        const open = (event: MouseEvent) => {
          if (!onOpen) return;
          event.preventDefault();
          onOpen(item);
        };
        return (
          <li
            key={item.id}
            className={cn(
              "group flex items-start gap-3 px-3 py-2.5",
              item.read ? "bg-transparent" : "bg-surface-raised"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "mt-1.5 size-2 shrink-0 rounded-full",
                item.read ? "bg-transparent" : "bg-accent"
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                {item.read ? null : <span className="sr-only">Unread: </span>}
                {item.href ? (
                  <a
                    href={item.href}
                    onClick={open}
                    className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {item.title}
                  </a>
                ) : (
                  item.title
                )}
              </p>
              {item.body ? (
                <p className="mt-0.5 text-xs text-fg-muted">{item.body}</p>
              ) : null}
              <time
                dateTime={item.createdAt}
                className="mt-1 block text-2xs text-fg-muted"
              >
                {relativeTime(item.createdAt, now)}
              </time>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {!item.read && onMarkRead ? (
                <IconButton
                  size="xs"
                  label={`Mark read: ${item.title}`}
                  onClick={() => onMarkRead(item.id)}
                >
                  <Check />
                </IconButton>
              ) : null}
              {!item.archived && onArchive ? (
                <IconButton
                  size="xs"
                  label={`Archive: ${item.title}`}
                  onClick={() => onArchive(item.id)}
                >
                  <Archive />
                </IconButton>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** The list while it loads: rows shaped like notifications. */
export function NotificationListSkeleton({
  rows = 4,
}: {
  readonly rows?: number;
}) {
  return (
    <div aria-hidden className="divide-y divide-line">
      {Array.from({ length: rows }, (_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
          key={index}
          className="flex items-start gap-3 px-3 py-3"
        >
          <Skeleton className="mt-1 size-2 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-3/5" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-2.5 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}
