import { z } from "zod";
import { DomainError, defineJob } from "../../kernel";

export const STORAGE_RECONCILE_MODES = ["off", "report", "delete"] as const;
export type StorageReconcileMode = (typeof STORAGE_RECONCILE_MODES)[number];
export const STORAGE_GRACE_MS = 24 * 60 * 60 * 1000;
export const STORAGE_SCAN_PAGE_SIZE = 100;
export const STORAGE_SCAN_PREFIXES = ["workspaces/", "users/"] as const;
export const reconciliationPayload = z
  .object({
    runId: z.uuid(),
    mode: z.enum(["report", "delete"]),
    trigger: z.enum(["scheduled", "manual"]),
    asOf: z.iso.datetime(),
    prefix: z.enum(STORAGE_SCAN_PREFIXES),
    cursor: z.string().min(1).optional(),
  })
  .strict();
export type ReconciliationInput = z.infer<typeof reconciliationPayload>;
export const reconcileStorageJob = defineJob({
  type: "storage.reconcile",
  payload: reconciliationPayload,
  backoff: { initialDelaySeconds: 60, maxDelaySeconds: 3600, jitter: "equal" },
});

/** The cutoff stays fixed for all pages and retries; never adopt new keys mid-run. */
export function isOldStorageObject(uploaded: Date, asOf: Date): boolean {
  return uploaded.getTime() < asOf.getTime() - STORAGE_GRACE_MS;
}

/** A config change can stop a scheduled run or downgrade deletion, never upgrade it. */
export function effectiveReconciliationMode(
  setting: StorageReconcileMode,
  input: Pick<ReconciliationInput, "mode" | "trigger">
): "report" | "delete" | null {
  if (input.trigger === "scheduled" && setting === "off") return null;
  return input.mode === "delete" && setting === "delete" ? "delete" : "report";
}

export class StorageDeletionDisabledError extends DomainError {
  constructor() {
    super(
      "forbidden",
      "Storage deletion requires STORAGE_RECONCILE=delete",
      "STORAGE_DELETION_DISABLED"
    );
  }
}
