import { Bell } from "lucide-react";
import type { ReactNode } from "react";

import { IconButton } from "../button";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";

export interface NotificationBellProps {
  /** Unread notifications; the badge shows "99+" above 99 and nothing at 0. */
  readonly unreadCount: number;
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  /** The popover's content, usually a `NotificationInbox` with `variant="popover"`. */
  readonly children: ReactNode;
}

/** "3 unread" for the accessible name; the badge's short form. */
function badgeText(count: number): string {
  return count > 99 ? "99+" : String(count);
}

/**
 * The bell in the app's top bar: an unread badge, and a popover with the inbox. Its
 * accessible name says how many are unread ("Notifications, 3 unread").
 */
export function NotificationBell({
  unreadCount,
  open,
  defaultOpen,
  onOpenChange,
  children,
}: NotificationBellProps) {
  const label =
    unreadCount > 0
      ? `Notifications, ${badgeText(unreadCount)} unread`
      : "Notifications";
  return (
    <Popover open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <IconButton label={label} className="relative">
          <Bell />
          {unreadCount > 0 ? (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-solid px-1 text-2xs font-semibold leading-none text-on-solid"
            >
              {badgeText(unreadCount)}
            </span>
          ) : null}
        </IconButton>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label="Notifications"
        className="w-[min(24rem,calc(100vw-2rem))] p-0"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
