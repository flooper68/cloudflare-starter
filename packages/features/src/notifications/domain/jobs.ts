import { z } from "zod";

import { defineJob } from "../../kernel";
import { digestDate } from "./digest";

/** Most recipients one event may have; a producer with more splits them into several. */
export const MAX_RECIPIENTS = 500;

const id = z.string().min(1).max(200);

/**
 * One notification event, a CloudEvents 1.0 event (structured JSON): `type` is the
 * notification type (`workspaces.member-joined`), `id` the event id, `data` the
 * notification's data. It travels as the payload of the `notifications.dispatch` job,
 * whose own envelope type routes it to the dispatcher.
 */
export const notificationEventSchema = z
  .object({
    specversion: z.literal("1.0"),
    id,
    source: z.string().min(1).max(200),
    type: z.string().min(1).max(100),
    time: z.iso.datetime(),
    datacontenttype: z.literal("application/json"),
    data: z.unknown(),
    /** Extension attribute: the workspace the event is about, if any. */
    workspaceid: id.optional(),
  })
  .strict();
export type NotificationEvent = z.infer<typeof notificationEventSchema>;

/**
 * Turns one event into inbox rows and email jobs, per recipient and their preferences.
 * Keyed by the event id: a redelivered or re-enqueued event is dispatched once.
 */
export const dispatchNotificationJob = defineJob({
  type: "notifications.dispatch",
  payload: z
    .object({
      event: notificationEventSchema,
      recipients: z.array(id).min(1).max(MAX_RECIPIENTS),
    })
    .strict(),
  backoff: { initialDelaySeconds: 10, maxDelaySeconds: 600, jitter: "full" },
  idempotencyKey: (payload) => payload.event.id,
});

/** Mails one inbox row. Keyed by the row: a retry after a sent mail does not send again. */
export const sendNotificationEmailJob = defineJob({
  type: "notifications.send-email",
  payload: z.object({ notificationId: id }).strict(),
  backoff: { initialDelaySeconds: 30, maxDelaySeconds: 3600, jitter: "full" },
  idempotencyKey: (payload) => `email-${payload.notificationId}`,
});

/**
 * Finds the users with notifications waiting for the daily digest and enqueues one
 * `notifications.send-digest` each. `asOf` is the cron run's time.
 */
export const planDigestsJob = defineJob({
  type: "notifications.plan-digests",
  payload: z.object({ asOf: z.iso.datetime() }).strict(),
  backoff: { initialDelaySeconds: 60, maxDelaySeconds: 3600, jitter: "equal" },
});

/** Mails one user's digest of the day. Keyed by user and UTC date: one digest a day. */
export const sendDigestJob = defineJob({
  type: "notifications.send-digest",
  payload: z.object({ userId: id, asOf: z.iso.datetime() }).strict(),
  backoff: { initialDelaySeconds: 60, maxDelaySeconds: 3600, jitter: "full" },
  idempotencyKey: (payload) =>
    `digest-${payload.userId}-${digestDate(new Date(payload.asOf))}`,
});

/** Deletes inbox rows past retention (retention.ts); `asOf` is the cron run's time. */
export const purgeNotificationsJob = defineJob({
  type: "notifications.purge",
  payload: z.object({ asOf: z.iso.datetime() }).strict(),
  backoff: { initialDelaySeconds: 60, maxDelaySeconds: 3600, jitter: "equal" },
});
