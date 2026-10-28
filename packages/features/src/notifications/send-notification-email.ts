import { and, eq } from "drizzle-orm";

import { user } from "../accounts";
import type { Database } from "../database";
import type { EmailService, Logger } from "../platform";
import {
  deriveUnsubscribeKey,
  findNotification,
  type NotificationCatalog,
  notificationMail,
  signUnsubscribeToken,
  unsubscribeUrl,
} from "./domain";
import { notifications } from "./notifications.schema";

/** The app as mail sees it: its name, public URL and the secret unsubscribe keys come from. */
export interface MailApp {
  readonly name: string;
  /** APP_URL without a trailing slash. */
  readonly url: string;
  /** BETTER_AUTH_SECRET: the unsubscribe key is derived from it (HKDF). */
  readonly secret: string;
}

/**
 * Handler of `notifications.send-email`: mails one inbox row whose email is `pending`,
 * rendered by its definition in the mail layout, with the RFC 8058 unsubscribe headers
 * unless it is security-critical, then marks it `sent`. A row that is gone or no longer
 * pending (sent already, the user deleted) is left alone. With email off for the
 * deployment it is marked `skipped` instead.
 */
export async function sendNotificationEmail(
  deps: {
    readonly db: Database;
    readonly email: EmailService;
    readonly logger: Logger;
    readonly catalog: NotificationCatalog;
    readonly app: MailApp;
  },
  input: { readonly notificationId: string }
): Promise<"sent" | "skipped" | "not_pending"> {
  const [row] = await deps.db
    .select({
      id: notifications.id,
      type: notifications.type,
      data: notifications.data,
      emailState: notifications.emailState,
      userId: notifications.userId,
      email: user.email,
      name: user.name,
    })
    .from(notifications)
    .innerJoin(user, eq(user.id, notifications.userId))
    .where(eq(notifications.id, input.notificationId));
  if (!row || row.emailState !== "pending") return "not_pending";

  const markAs = (emailState: "sent" | "skipped") =>
    deps.db
      .update(notifications)
      .set({ emailState })
      .where(
        and(
          eq(notifications.id, row.id),
          eq(notifications.emailState, "pending")
        )
      );

  if (!deps.email.enabled) {
    deps.logger.warn("notifications.email_skipped", {
      "app.notification.type": row.type,
      "app.notification.reason": "email is not configured",
    });
    await markAs("skipped");
    return "skipped";
  }

  const definition = findNotification(deps.catalog, row.type);
  const rendered = definition.render(row.data, { appUrl: deps.app.url });
  const link = definition.securityCritical
    ? null
    : unsubscribeUrl(
        deps.app.url,
        await signUnsubscribeToken(
          await deriveUnsubscribeKey(deps.app.secret),
          {
            userId: row.userId,
            type: row.type,
          }
        )
      );
  const mail = notificationMail({
    appName: deps.app.name,
    appUrl: deps.app.url,
    content: rendered.email,
    unsubscribeUrl: link,
  });
  await deps.email.send({
    to: { email: row.email, name: row.name },
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    headers: mail.headers,
  });
  await markAs("sent");
  return "sent";
}
