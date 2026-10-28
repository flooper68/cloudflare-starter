import { and, isNotNull, lt, or } from "drizzle-orm";

import type { Database } from "../database";
import type { Clock } from "../kernel";
import { notificationRetentionCutoffs } from "./domain";
import { notifications } from "./notifications.schema";

/**
 * Handler of `notifications.purge`: deletes inbox rows past retention (retention.ts):
 * read or archived ones older than 90 days, any older than 365 days. The clock is the
 * cron run's time, so every retry purges against the same cutoffs.
 */
export async function purgeNotifications(deps: {
  readonly db: Database;
  readonly clock: Clock;
}): Promise<{ readonly deleted: number }> {
  const { readBefore, unreadBefore } = notificationRetentionCutoffs(
    deps.clock.now()
  );
  const deleted = await deps.db
    .delete(notifications)
    .where(
      or(
        lt(notifications.createdAt, unreadBefore),
        and(
          lt(notifications.createdAt, readBefore),
          or(
            isNotNull(notifications.readAt),
            isNotNull(notifications.archivedAt)
          )
        )
      )
    )
    .returning({ id: notifications.id });
  return { deleted: deleted.length };
}
