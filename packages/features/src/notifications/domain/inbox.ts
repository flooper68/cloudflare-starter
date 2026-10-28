import { z } from "zod";

import { NOTIFICATION_CHANNELS } from "../../kernel";
import { EMAIL_CADENCES } from "./preferences";

/** Which part of the inbox to list. */
export const INBOX_VIEWS = ["inbox", "unread", "archived"] as const;
export type InboxView = (typeof INBOX_VIEWS)[number];

const notificationId = z.string().min(1).max(100);

/** Input of `notifications.list`. */
export const listNotificationsInputSchema = z.object({
  view: z
    .enum(INBOX_VIEWS)
    .describe(
      "inbox: everything not archived; unread: not read and not archived; archived: archived only."
    ),
  limit: z.number().int().min(1).max(50).describe("Page size, 1-50."),
  cursor: z
    .string()
    .max(200)
    .optional()
    .describe("nextCursor of the previous page; omit for the newest."),
});
export type ListNotificationsInput = z.infer<
  typeof listNotificationsInputSchema
>;

/**
 * Input of `notifications.markRead`: some ids, or `all` (optionally only one workspace's).
 * Exactly one of `ids` and `all`.
 */
export const markReadInputSchema = z
  .object({
    ids: z
      .array(notificationId)
      .min(1)
      .max(100)
      .optional()
      .describe("Notification ids to mark read (see list_notifications)."),
    all: z
      .literal(true)
      .optional()
      .describe("Mark every unread notification read instead of ids."),
    workspaceId: z
      .string()
      .min(1)
      .max(100)
      .optional()
      .describe("With all: only the notifications about this workspace."),
  })
  .superRefine((value, context) => {
    if ((value.ids === undefined) === (value.all === undefined)) {
      context.addIssue({
        code: "custom",
        message: "Give either ids or all: true",
      });
    }
    if (value.ids && value.workspaceId) {
      context.addIssue({
        code: "custom",
        message: "workspaceId goes with all: true only",
      });
    }
  });
export type MarkReadInput = z.infer<typeof markReadInputSchema>;

/** Input of `notifications.archive`. */
export const archiveInputSchema = z.object({
  ids: z
    .array(notificationId)
    .min(1)
    .max(100)
    .describe("Notification ids to archive (see list_notifications)."),
});

/** Input of `notifications.preferences.update`. */
export const preferencesUpdateSchema = z.object({
  changes: z
    .array(
      z
        .object({
          type: z
            .string()
            .min(1)
            .max(100)
            .describe("Notification type (see get_notification_preferences)."),
          channel: z.enum(NOTIFICATION_CHANNELS),
          enabled: z.boolean(),
        })
        .strict()
    )
    .max(100)
    .describe("Channel switches to set; security notifications cannot change."),
  emailCadence: z
    .enum(EMAIL_CADENCES)
    .optional()
    .describe("instant: one mail each; daily: one summary mail a day."),
});
export type PreferencesUpdate = z.infer<typeof preferencesUpdateSchema>;

/** A position in the inbox, newest first: the last row's time and id. */
export interface InboxCursor {
  readonly createdAt: Date;
  readonly id: string;
}

/** `<epoch ms>:<id>`; opaque to clients. */
export function encodeInboxCursor(cursor: InboxCursor): string {
  return `${cursor.createdAt.getTime()}:${cursor.id}`;
}

/** The cursor, or null when the string is not one. */
export function decodeInboxCursor(value: string): InboxCursor | null {
  const match = /^(\d{1,15}):(.{1,100})$/.exec(value);
  if (!match) return null;
  return { createdAt: new Date(Number(match[1])), id: match[2] as string };
}
