import { enqueueJob } from "../jobs";
import type {
  Clock,
  Ids,
  NotificationDefinition,
  NotifyInput,
  NotifyResult,
} from "../kernel";
import type { ErrorReporter, JobQueue } from "../platform";
import {
  dispatchNotificationJob,
  InvalidNotificationDataError,
  MAX_RECIPIENTS,
  TooManyRecipientsError,
} from "./domain";

/**
 * Sends a notification: validates the data against the definition, drops the actor from
 * the recipients (unless the notification is security-critical: then the actor is who to
 * warn), and enqueues one `notifications.dispatch` job carrying the event (CloudEvents, its
 * type the notification type, its id the job's idempotency key). Nothing is written here;
 * the dispatcher applies preferences and writes the inbox. With nobody left to notify,
 * nothing is enqueued. The app binds it as `deps.notify` (the kernel's `Notify`).
 *
 * Never throws: producers call it after their change is saved, and a notification must not
 * turn a done change into a failed request. Invalid data, too many recipients or a failed
 * queue send are reported once through the ErrorReporter (with the producer's context) and
 * answered `{ status: "failed", reference }`, which callers may ignore.
 */
export async function notify<TData>(
  deps: {
    readonly jobQueue: JobQueue;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly errors: ErrorReporter;
  },
  definition: NotificationDefinition<TData>,
  input: NotifyInput<TData>
): Promise<NotifyResult> {
  const { requestContext, workspaceId } = input.context;
  try {
    const parsed = definition.data.safeParse(input.data);
    if (!parsed.success) {
      throw new InvalidNotificationDataError(definition.type, parsed.error);
    }
    const actor = requestContext.userId;
    const recipients = [...new Set(input.recipients)].filter(
      (userId) => definition.securityCritical || userId !== actor
    );
    if (recipients.length > MAX_RECIPIENTS) {
      throw new TooManyRecipientsError(MAX_RECIPIENTS);
    }
    if (recipients.length === 0) return { status: "nobody" };

    const eventId = deps.ids.uuid();
    await enqueueJob(
      deps,
      dispatchNotificationJob,
      {
        event: {
          specversion: "1.0",
          id: eventId,
          source: `/${requestContext.environment}/${requestContext.source}`,
          type: definition.type,
          time: deps.clock.now().toISOString(),
          datacontenttype: "application/json",
          data: parsed.data,
          ...(workspaceId ? { workspaceid: workspaceId } : {}),
        },
        recipients,
      },
      { context: requestContext }
    );
    return { status: "enqueued", eventId, recipients: recipients.length };
  } catch (error) {
    const reference = deps.errors.capture(error, requestContext, {
      "app.notification.type": definition.type,
    });
    return { status: "failed", reference };
  }
}
