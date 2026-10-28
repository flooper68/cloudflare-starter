import { and, eq, lte } from "drizzle-orm";

import type { Database } from "../database";
import { enqueueJob } from "../jobs";
import type { Clock, Ids, RequestContext } from "../kernel";
import type { JobQueue } from "../platform";
import { sendDigestJob } from "./domain";
import { notifications } from "./notifications.schema";

/**
 * Handler of `notifications.plan-digests`: enqueues one `notifications.send-digest` for
 * each user with notifications waiting for the digest (created up to `asOf`). The digest
 * job's key (user and UTC date) keeps a retried plan from mailing twice.
 */
export async function planDigests(
  deps: {
    readonly db: Database;
    readonly jobQueue: JobQueue;
    readonly clock: Clock;
    readonly ids: Ids;
  },
  input: { readonly asOf: Date; readonly context: RequestContext }
): Promise<{ readonly users: number }> {
  const users = await deps.db
    .selectDistinct({ userId: notifications.userId })
    .from(notifications)
    .where(
      and(
        eq(notifications.emailState, "pending_digest"),
        lte(notifications.createdAt, input.asOf)
      )
    );
  for (const { userId } of users) {
    await enqueueJob(
      deps,
      sendDigestJob,
      { userId, asOf: input.asOf.toISOString() },
      { context: input.context }
    );
  }
  return { users: users.length };
}
