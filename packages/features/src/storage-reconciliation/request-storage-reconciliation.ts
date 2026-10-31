import type { AdminActor } from "../admin";
import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import { enqueueJob } from "../jobs";
import type { Clock, Ids, RequestContext } from "../kernel";
import type { JobQueue } from "../platform";
import {
  reconcileStorageJob,
  StorageDeletionDisabledError,
  type StorageReconcileMode,
} from "./domain";

/** Admin-triggered runs are report-only unless explicitly requested and enabled. */
export async function requestStorageReconciliation(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly jobQueue: JobQueue;
    readonly storageReconcile: StorageReconcileMode;
  },
  admin: AdminActor,
  input: { readonly deleteOrphans?: boolean } = {}
) {
  if (input.deleteOrphans && deps.storageReconcile !== "delete")
    throw new StorageDeletionDisabledError();
  const mode = input.deleteOrphans ? "delete" : "report";
  const runId = deps.ids.uuid();
  const { id: jobId } = await enqueueJob(
    deps,
    reconcileStorageJob,
    {
      runId,
      mode,
      trigger: "manual",
      asOf: deps.clock.now().toISOString(),
      prefix: "workspaces/",
    },
    { context: deps.requestContext }
  );
  await recordAuditEvent(deps, deps.requestContext, {
    action: "storage.reconciliation_requested",
    actor: { kind: "admin", userId: admin.userId },
    target: { type: "storage", id: runId },
    metadata: { mode },
  });
  return { runId, jobId, mode };
}
