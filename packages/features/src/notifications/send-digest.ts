import { and, asc, eq, inArray, lte } from "drizzle-orm";

import { user } from "../accounts";
import type { Database } from "../database";
import type { EmailService, Logger } from "../platform";
import {
  type DigestEntry,
  deriveUnsubscribeKey,
  digestContent,
  type NotificationCatalog,
  notificationMail,
  signUnsubscribeToken,
  UNSUBSCRIBE_ALL,
  unsubscribeUrl,
} from "./domain";
import { notifications } from "./notifications.schema";
import type { MailApp } from "./send-notification-email";

/** Most rows one digest lists; older ones wait for the next day. */
const DIGEST_LIMIT = 90;

/**
 * Handler of `notifications.send-digest`: mails one user the notifications waiting for
 * the digest (created up to `asOf`), grouped by type, with a link that unsubscribes from
 * all notification mail that can be turned off, then marks them `sent`. Types no longer
 * in the catalog are marked sent without being listed. Nothing waiting: nothing sent.
 */
export async function sendDigest(
  deps: {
    readonly db: Database;
    readonly email: EmailService;
    readonly logger: Logger;
    readonly catalog: NotificationCatalog;
    readonly app: MailApp;
  },
  input: { readonly userId: string; readonly asOf: Date }
): Promise<{ readonly sent: number }> {
  const [recipient] = await deps.db
    .select({ email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, input.userId));
  if (!recipient) return { sent: 0 };
  const rows = await deps.db
    .select({
      id: notifications.id,
      type: notifications.type,
      data: notifications.data,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, input.userId),
        eq(notifications.emailState, "pending_digest"),
        lte(notifications.createdAt, input.asOf)
      )
    )
    .orderBy(asc(notifications.createdAt))
    .limit(DIGEST_LIMIT);
  if (rows.length === 0) return { sent: 0 };

  const ids = rows.map((row) => row.id);
  const markAs = (emailState: "sent" | "skipped") =>
    deps.db
      .update(notifications)
      .set({ emailState })
      .where(
        and(
          inArray(notifications.id, ids),
          eq(notifications.emailState, "pending_digest")
        )
      );
  if (!deps.email.enabled) {
    deps.logger.warn("notifications.email_skipped", {
      "app.notification.type": "digest",
      "app.notification.reason": "email is not configured",
    });
    await markAs("skipped");
    return { sent: 0 };
  }

  const entries: DigestEntry[] = rows.flatMap((row) => {
    const definition = deps.catalog.get(row.type);
    if (!definition) return [];
    const { inApp } = definition.render(row.data, { appUrl: deps.app.url });
    return [{ type: row.type, label: definition.label, ...inApp }];
  });
  if (entries.length > 0) {
    const token = await signUnsubscribeToken(
      await deriveUnsubscribeKey(deps.app.secret),
      { userId: input.userId, type: UNSUBSCRIBE_ALL }
    );
    const mail = notificationMail({
      appName: deps.app.name,
      appUrl: deps.app.url,
      content: digestContent(entries, deps.app.url),
      unsubscribeUrl: unsubscribeUrl(deps.app.url, token),
    });
    await deps.email.send({
      to: { email: recipient.email, name: recipient.name },
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      headers: mail.headers,
    });
  }
  await markAs("sent");
  return { sent: entries.length };
}
