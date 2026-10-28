import { and, eq, inArray } from "drizzle-orm";

import { user } from "../accounts";
import type { Database } from "../database";
import { enqueueJob } from "../jobs";
import type { Clock, Ids, RequestContext } from "../kernel";
import type { EmailService, JobQueue, Logger } from "../platform";
import {
  DEFAULT_EMAIL_CADENCE,
  findNotification,
  InvalidNotificationDataError,
  initialEmailState,
  type NotificationCatalog,
  type NotificationEvent,
  resolveChannels,
  sendNotificationEmailJob,
} from "./domain";
import {
  notificationPreferences,
  notificationSettings,
  notifications,
} from "./notifications.schema";

/** D1 binds at most 100 parameters per statement: recipients are handled in chunks. */
const CHUNK = 50;

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

/**
 * Handler of `notifications.dispatch`: for each recipient that still exists, resolves
 * their channels (type defaults, their overrides, the security lock) and email cadence,
 * writes one inbox row (`in_app` false when only email is on; no row when both are off)
 * and enqueues `notifications.send-email` for each row whose email is due now. Rows
 * whose email waits for the digest are `pending_digest`; with email off for the
 * deployment they are `skipped` (and a warning is logged). Safe to run again: rows are
 * unique per user and event, and email jobs are keyed by row.
 */
export async function dispatchNotification(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly logger: Logger;
    readonly jobQueue: JobQueue;
    readonly email: Pick<EmailService, "enabled">;
    readonly catalog: NotificationCatalog;
  },
  input: {
    readonly event: NotificationEvent;
    readonly recipients: readonly string[];
    /** The delivery's context: email jobs continue its trace. */
    readonly context: RequestContext;
  }
): Promise<{ readonly rows: number; readonly emails: number }> {
  const { event } = input;
  const definition = findNotification(deps.catalog, event.type);
  const parsed = definition.data.safeParse(event.data);
  if (!parsed.success) {
    throw new InvalidNotificationDataError(event.type, parsed.error);
  }
  const createdAt = new Date(event.time);
  let rows = 0;
  let skipped = 0;

  for (const recipients of chunks([...new Set(input.recipients)], CHUNK)) {
    const [existing, overrides, settings] = await Promise.all([
      deps.db
        .select({ id: user.id })
        .from(user)
        .where(inArray(user.id, recipients)),
      deps.db
        .select({
          userId: notificationPreferences.userId,
          type: notificationPreferences.type,
          channel: notificationPreferences.channel,
          enabled: notificationPreferences.enabled,
        })
        .from(notificationPreferences)
        .where(
          and(
            inArray(notificationPreferences.userId, recipients),
            eq(notificationPreferences.type, event.type)
          )
        ),
      deps.db
        .select()
        .from(notificationSettings)
        .where(inArray(notificationSettings.userId, recipients)),
    ]);

    const values = existing.flatMap(({ id: userId }) => {
      const channels = resolveChannels(
        definition,
        overrides.filter((entry) => entry.userId === userId)
      );
      if (!channels.inApp && !channels.email) return [];
      const cadence =
        settings.find((entry) => entry.userId === userId)?.emailCadence ??
        DEFAULT_EMAIL_CADENCE;
      const emailState = initialEmailState(definition, channels, {
        cadence,
        emailEnabled: deps.email.enabled,
      });
      if (emailState === "skipped") skipped += 1;
      return [
        {
          id: deps.ids.uuid(),
          userId,
          workspaceId: event.workspaceid ?? null,
          type: event.type,
          data: parsed.data,
          inApp: channels.inApp,
          emailState,
          eventId: event.id,
          createdAt,
        },
      ];
    });
    if (values.length === 0) continue;
    // One statement per row keeps each under D1's parameter limit; a row of a redelivered
    // event already exists and is left as it is.
    const [first, ...rest] = values.map((value) =>
      deps.db.insert(notifications).values(value).onConflictDoNothing()
    );
    if (first) await deps.db.batch([first, ...rest]);
    rows += values.length;
  }

  if (skipped > 0) {
    deps.logger.warn("notifications.email_skipped", {
      "app.notification.type": event.type,
      "app.notification.event_id": event.id,
      "app.notification.skipped": skipped,
      "app.notification.reason": "email is not configured",
    });
  }

  // Every row of this event still due, including rows a failed earlier attempt wrote: the
  // email job's key (email-<row id>) keeps each mail to one send.
  const due = await deps.db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.eventId, event.id),
        eq(notifications.emailState, "pending")
      )
    );
  for (const row of due) {
    await enqueueJob(
      deps,
      sendNotificationEmailJob,
      { notificationId: row.id },
      { context: input.context }
    );
  }
  return { rows, emails: due.length };
}
