import type {
  NotificationItem,
  NotificationView,
} from "@cloudflare-starter/ui";
import { toast } from "@cloudflare-starter/ui";
import { useCallback, useEffect, useState } from "react";

import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";

/** How often the unread count refreshes while the page is visible. */
export const UNREAD_REFRESH_MS = 60_000;

function failed(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Something went wrong");
}

/**
 * The unread count for the bell: loaded on mount, again when the window regains focus or
 * becomes visible, and every 60 s while it is visible. Polling is the starter's choice;
 * a Durable Object pushing changes is the realtime upgrade
 * (docs/guides/how-to-send-notifications.md#realtime).
 */
export function useUnreadCount() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setCount((await trpc.notifications.unreadCount.query()).count);
    } catch {
      // The badge keeps its last value; the inbox shows load errors.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, UNREAD_REFRESH_MS);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return { count, refresh };
}

/** One page of the inbox in `view`, with the actions the inbox offers. */
export function useInbox(
  view: NotificationView,
  options: { readonly limit: number; readonly onChange?: () => unknown }
) {
  const [pages, setPages] = useState(1);
  const data = useAsync(async () => {
    const items: NotificationItem[] = [];
    let cursor: string | undefined;
    let nextCursor: string | null = null;
    for (let page = 0; page < pages; page++) {
      const result = await trpc.notifications.list.query({
        view,
        limit: options.limit,
        cursor,
      });
      items.push(
        ...result.items.map((item) => ({
          id: item.id,
          title: item.title,
          body: item.body,
          href: item.href,
          createdAt: item.createdAt,
          read: item.readAt !== null,
          archived: item.archivedAt !== null,
        }))
      );
      nextCursor = result.nextCursor;
      if (!nextCursor) break;
      cursor = nextCursor;
    }
    return { items, hasMore: nextCursor !== null };
  }, `${view}:${pages}:${options.limit}`);

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
      await Promise.all([data.refetch(), options.onChange?.()]);
    } catch (error) {
      failed(error);
    }
  }

  return {
    data,
    loadMore: () => setPages((count) => count + 1),
    markRead: (ids: string[]) =>
      run(() => trpc.notifications.markRead.mutate({ ids })),
    markAllRead: () =>
      run(() => trpc.notifications.markRead.mutate({ all: true })),
    archive: (ids: string[]) =>
      run(() => trpc.notifications.archive.mutate({ ids })),
  };
}
