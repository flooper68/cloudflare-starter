import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { user } from "../accounts";

/**
 * Which funnel milestones a person reached (a feature tried, a return on a later day), so
 * each of these product events is sent once per person (`app.feature_tried`,
 * `app.session_returned`). The row holds no content: the milestone id and when. Deleted
 * with the account.
 */
export const analyticsMilestones = sqliteTable(
  "analytics_milestones",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** A TRIED_FEATURES id, or `returned`. */
    milestone: text("milestone").notNull(),
    reachedAt: integer("reached_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.milestone] })]
);
