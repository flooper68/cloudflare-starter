import { and, count, eq, isNull } from "drizzle-orm";

import type { Database } from "../database";
import { notifications } from "./notifications.schema";

/** Most unread notifications counted; the badge shows "99+" above it. */
const COUNT_CAP = 100;

/**
 * How many of the user's inbox notifications are unread and not archived, capped at 100
 * (the badge's "99+"), so the count stays cheap. Uses the partial index on unread rows.
 */
export async function countUnreadNotifications(
  deps: { readonly db: Database },
  input: { readonly userId: string }
): Promise<{ readonly count: number }> {
  const n = notifications;
  const capped = deps.db
    .select({ id: n.id })
    .from(n)
    .where(
      and(
        eq(n.userId, input.userId),
        isNull(n.readAt),
        isNull(n.archivedAt),
        eq(n.inApp, true)
      )
    )
    .limit(COUNT_CAP)
    .as("capped");
  const [row] = await deps.db.select({ count: count() }).from(capped);
  return { count: row?.count ?? 0 };
}
