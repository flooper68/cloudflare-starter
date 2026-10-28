import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "../accounts";
import { NOTIFICATION_CHANNELS } from "../kernel";
import { workspaces } from "../workspaces";

import { EMAIL_CADENCES } from "./domain";

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

/** What happened to a row's email: none (channel off), waiting, sent, or skipped (email off). */
export const EMAIL_STATES = [
  "none",
  "pending",
  "pending_digest",
  "sent",
  "skipped",
] as const;

/**
 * One notification for one user: the inbox row (`in_app`) and the state of its email.
 * Messages belong to the user, not a workspace: `workspace_id` names the workspace it is
 * about, if any, and the row goes with the workspace or the user.
 */
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    type: text("type").notNull(),
    data: text("data", { mode: "json" }).$type<unknown>().notNull(),
    /** Shown in the inbox; false when the user turned the in-app channel off (email only). */
    inApp: integer("in_app", { mode: "boolean" }).notNull(),
    emailState: text("email_state", { enum: EMAIL_STATES }).notNull(),
    /** The notification event (CloudEvents id); one row per user and event. */
    eventId: text("event_id").notNull(),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(now)
      .notNull(),
  },
  (table) => [
    uniqueIndex("notifications_user_id_event_id_idx").on(
      table.userId,
      table.eventId
    ),
    index("notifications_user_id_archived_at_created_at_idx").on(
      table.userId,
      table.archivedAt,
      table.createdAt
    ),
    index("notifications_unread_idx")
      .on(table.userId)
      .where(sql`${table.readAt} IS NULL`),
    index("notifications_email_state_idx")
      .on(table.emailState, table.userId)
      .where(sql`${table.emailState} = 'pending_digest'`),
    index("notifications_event_id_idx").on(table.eventId),
    index("notifications_created_at_idx").on(table.createdAt),
  ]
);

/** A user's choice for one type and channel, stored only where it differs from the default. */
export const notificationPreferences = sqliteTable(
  "notification_preferences",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    channel: text("channel", { enum: NOTIFICATION_CHANNELS }).notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.type, table.channel] }),
  ]
);

/** A user's notification settings; no row means the defaults (instant email). */
export const notificationSettings = sqliteTable("notification_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  emailCadence: text("email_cadence", { enum: EMAIL_CADENCES }).notNull(),
});
