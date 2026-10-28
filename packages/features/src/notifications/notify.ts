import { enqueueJob } from "../jobs";
import type {
  Clock,
  Ids,
  NotificationDefinition,
  NotifyInput,
} from "../kernel";
import type { JobQueue } from "../platform";
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
 */
export async function notify<TData>(
  deps: {
    readonly jobQueue: JobQueue;
    readonly clock: Clock;
    readonly ids: Ids;
  },
  definition: NotificationDefinition<TData>,
  input: NotifyInput<TData>
): Promise<{ readonly eventId: string; readonly recipients: number }> {
  const parsed = definition.data.safeParse(input.data);
  if (!parsed.success) {
    throw new InvalidNotificationDataError(definition.type, parsed.error);
  }
  const { requestContext, workspaceId } = input.context;
  const actor = requestContext.userId;
  const recipients = [...new Set(input.recipients)].filter(
    (userId) => definition.securityCritical || userId !== actor
  );
  if (recipients.length > MAX_RECIPIENTS) {
    throw new TooManyRecipientsError(MAX_RECIPIENTS);
  }
  const eventId = deps.ids.uuid();
  if (recipients.length === 0) return { eventId, recipients: 0 };

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
  return { eventId, recipients: recipients.length };
}
