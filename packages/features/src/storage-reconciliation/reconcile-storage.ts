import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import { enqueueJob } from "../jobs";
import type { Clock, Ids, RequestContext } from "../kernel";
import type { JobQueue, Logger } from "../platform";
import type { StorageReferenceSource } from "./domain";
import {
  effectiveReconciliationMode,
  isOldStorageObject,
  type ReconciliationInput,
  reconcileStorageJob,
  STORAGE_SCAN_PAGE_SIZE,
  type StorageReconcileMode,
} from "./domain";

/** One bounded R2 list page. Immutable upload keys and a fixed grace cutoff protect writes. */
export async function reconcileStorage(
  deps: {
    readonly db: Database;
    readonly bucket: R2Bucket;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly jobQueue: JobQueue;
    readonly logger: Logger;
    readonly storageReconcile: StorageReconcileMode;
    readonly references: readonly StorageReferenceSource[];
  },
  input: ReconciliationInput
) {
  const mode = effectiveReconciliationMode(deps.storageReconcile, input);
  if (mode === null)
    return {
      scanned: 0,
      orphaned: 0,
      deleted: 0,
      continued: false,
      mode: "off" as const,
    };
  const page = await deps.bucket.list({
    prefix: input.prefix,
    cursor: input.cursor,
    limit: STORAGE_SCAN_PAGE_SIZE,
  });
  const old = page.objects.filter((object) =>
    isOldStorageObject(object.uploaded, new Date(input.asOf))
  );
  const recognized = old.filter((object) =>
    deps.references.some((source) => source.matches(object.key))
  );
  const referenced = new Set<string>();
  // Each lookup is batched and failure stops the entire page before any deletion.
  for (const source of deps.references) {
    const keys = recognized
      .filter((object) => source.matches(object.key))
      .map((object) => object.key);
    for (const key of await source.referenced(keys)) referenced.add(key);
  }
  const orphans = recognized.filter((object) => !referenced.has(object.key));
  const keys = orphans.map((object) => object.key);
  if (mode === "delete" && keys.length) await deps.bucket.delete(keys);
  const continued = page.truncated || input.prefix === "workspaces/";
  const result = {
    scanned: page.objects.length,
    orphaned: keys.length,
    deleted: mode === "delete" ? keys.length : 0,
    continued,
    mode,
  };
  // Counts describe this page attempt. At-least-once delivery may repeat report audits.
  await recordAuditEvent(deps, deps.requestContext, {
    action: "storage.reconciliation_page",
    actor: { kind: "system" },
    target: { type: "storage", id: input.runId },
    metadata: { ...result, prefix: input.prefix, sampleKeys: keys.slice(0, 5) },
  });
  deps.logger.info("storage.reconciliation_page", {
    "app.storage.run_id": input.runId,
    "app.storage.mode": mode,
    "app.storage.scanned": result.scanned,
    "app.storage.orphaned": result.orphaned,
    "app.storage.deleted": result.deleted,
    "app.storage.sample_keys": JSON.stringify(keys.slice(0, 5)),
  });
  if (continued) {
    await enqueueJob(
      deps,
      reconcileStorageJob,
      {
        ...input,
        prefix: page.truncated ? input.prefix : "users/",
        cursor: page.truncated ? page.cursor : undefined,
      },
      { context: deps.requestContext }
    );
  }
  return result;
}
