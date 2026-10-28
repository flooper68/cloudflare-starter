import {
  and,
  desc,
  eq,
  isNotNull,
  isNull,
  lt,
  or,
  type SQL,
} from "drizzle-orm";

import type { Database } from "../database";
import {
  decodeInboxCursor,
  encodeInboxCursor,
  type ListNotificationsInput,
  type NotificationCatalog,
} from "./domain";
import { notifications } from "./notifications.schema";

/** One inbox entry, rendered in the user's words. */
export interface InboxItem {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly href: string | null;
  readonly workspaceId: string | null;
  readonly createdAt: string;
  readonly readAt: string | null;
  readonly archivedAt: string | null;
}

/**
 * The signed-in user's inbox, newest first, a page at a time: everything not archived,
 * the unread part of it, or the archive. Rows are rendered from their stored data with
 * the catalog's current wording; a type no longer in the catalog shows a generic title.
 */
export async function listNotifications(
  deps: {
    readonly db: Database;
    readonly catalog: NotificationCatalog;
    /** APP_URL without a trailing slash, for the definitions' render context. */
    readonly appUrl: string;
  },
  input: ListNotificationsInput & { readonly userId: string }
): Promise<{
  readonly items: readonly InboxItem[];
  readonly nextCursor: string | null;
}> {
  const n = notifications;
  const conditions: (SQL | undefined)[] = [
    eq(n.userId, input.userId),
    eq(n.inApp, true),
    input.view === "archived" ? isNotNull(n.archivedAt) : isNull(n.archivedAt),
    input.view === "unread" ? isNull(n.readAt) : undefined,
  ];
  const cursor = input.cursor ? decodeInboxCursor(input.cursor) : null;
  if (cursor) {
    conditions.push(
      or(
        lt(n.createdAt, cursor.createdAt),
        and(eq(n.createdAt, cursor.createdAt), lt(n.id, cursor.id))
      )
    );
  }
  const rows = await deps.db
    .select({
      id: n.id,
      type: n.type,
      data: n.data,
      workspaceId: n.workspaceId,
      createdAt: n.createdAt,
      readAt: n.readAt,
      archivedAt: n.archivedAt,
    })
    .from(n)
    .where(and(...conditions))
    .orderBy(desc(n.createdAt), desc(n.id))
    .limit(input.limit + 1);

  const page = rows.slice(0, input.limit);
  const last = page.at(-1);
  return {
    items: page.map((row) => {
      const definition = deps.catalog.get(row.type);
      const inApp = definition
        ? definition.render(row.data, { appUrl: deps.appUrl }).inApp
        : { title: "Notification", body: "", href: null };
      return {
        id: row.id,
        type: row.type,
        ...inApp,
        workspaceId: row.workspaceId,
        createdAt: row.createdAt.toISOString(),
        readAt: row.readAt?.toISOString() ?? null,
        archivedAt: row.archivedAt?.toISOString() ?? null,
      };
    }),
    nextCursor:
      rows.length > input.limit && last
        ? encodeInboxCursor({ createdAt: last.createdAt, id: last.id })
        : null,
  };
}
