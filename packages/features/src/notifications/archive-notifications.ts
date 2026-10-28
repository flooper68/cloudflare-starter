import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import type { Database } from "../database";
import type { Clock } from "../kernel";
import { notifications } from "./notifications.schema";

/**
 * Archives the user's notifications by id: they leave the inbox and count as read. Only
 * the recipient's own rows change: another user's ids are ignored. Returns how many changed.
 */
export async function archiveNotifications(
  deps: { readonly db: Database; readonly clock: Clock },
  input: { readonly userId: string; readonly ids: readonly string[] }
): Promise<{ readonly updated: number }> {
  const n = notifications;
  const now = deps.clock.now();
  const updated = await deps.db
    .update(n)
    .set({
      archivedAt: now,
      readAt: sql`coalesce(${n.readAt}, ${now.getTime()})`,
    })
    .where(
      and(
        eq(n.userId, input.userId),
        inArray(n.id, [...input.ids]),
        isNull(n.archivedAt)
      )
    )
    .returning({ id: n.id });
  return { updated: updated.length };
}
