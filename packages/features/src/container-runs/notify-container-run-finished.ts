import { eq } from "drizzle-orm";

import type { Database } from "../database";
import type { Notify, NotifyResult, RequestContext } from "../kernel";
import { containerRuns } from "./container-runs.schema";
import {
  ContainerRunNotFoundError,
  containerRunFinishedNotification,
} from "./domain";

/**
 * Tells the person who started a run that it finished (`container-runs.finished`): in the
 * app, and by email if their preferences say so. Nobody is told when that person's account
 * is gone. The workflow's request context has no user, so the starter is not dropped as
 * the actor.
 */
export async function notifyContainerRunFinished(
  deps: {
    readonly db: Database;
    readonly notify: Notify;
    readonly requestContext: RequestContext;
  },
  input: { readonly runId: string; readonly outcome: "succeeded" | "failed" }
): Promise<NotifyResult> {
  const [row] = await deps.db
    .select({
      workspaceId: containerRuns.workspaceId,
      createdBy: containerRuns.createdBy,
      digits: containerRuns.digits,
    })
    .from(containerRuns)
    .where(eq(containerRuns.id, input.runId));
  if (!row) throw new ContainerRunNotFoundError();
  if (!row.createdBy) return { status: "nobody" };
  return deps.notify(containerRunFinishedNotification, {
    recipients: [row.createdBy],
    data: { runId: input.runId, digits: row.digits, outcome: input.outcome },
    context: {
      workspaceId: row.workspaceId,
      requestContext: deps.requestContext,
    },
  });
}
