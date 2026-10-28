import { and, eq, inArray, isNull } from "drizzle-orm";

import type { Database } from "../database";
import type { Clock } from "../kernel";
import type { MarkReadInput } from "./domain";
import { notifications } from "./notifications.schema";

/**
 * Marks the user's notifications read: the given ids, or every unread one (optionally only
 * those about one workspace). Only the recipient's own rows change: another user's ids are
 * ignored. Returns how many changed.
 */
export async function markNotificationsRead(
  deps: { readonly db: Database; readonly clock: Clock },
  input: MarkReadInput & { readonly userId: string }
): Promise<{ readonly updated: number }> {
  const n = notifications;
  const scope = input.ids
    ? inArray(n.id, input.ids)
    : input.workspaceId
      ? eq(n.workspaceId, input.workspaceId)
      : undefined;
  const updated = await deps.db
    .update(n)
    .set({ readAt: deps.clock.now() })
    .where(and(eq(n.userId, input.userId), isNull(n.readAt), scope))
    .returning({ id: n.id });
  return { updated: updated.length };
}
