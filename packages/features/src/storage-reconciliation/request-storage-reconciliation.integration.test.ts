import { describe, expect, it } from "vitest";
import { rows, useCaseDeps } from "../../test/fixtures";
import { requestStorageReconciliation } from "./request-storage-reconciliation";

describe("requestStorageReconciliation", () => {
  it("defaults to report even when automatic maintenance is off and audits the request", async () => {
    const deps = { ...useCaseDeps(), storageReconcile: "off" as const };
    const result = await requestStorageReconciliation(deps, {
      userId: "admin",
    });
    expect(result.mode).toBe("report");
    expect(deps.jobQueue.sent[0]?.envelope).toMatchObject({
      type: "storage.reconcile",
      data: {
        mode: "report",
        trigger: "manual",
        prefix: "workspaces/",
        runId: result.runId,
      },
    });
    expect(await rows("SELECT actor_kind, action FROM audit_events")).toEqual([
      { actor_kind: "admin", action: "storage.reconciliation_requested" },
    ]);
  });
  it("refuses deletion unless explicitly configured", async () => {
    const deps = { ...useCaseDeps(), storageReconcile: "report" as const };
    await expect(
      requestStorageReconciliation(
        deps,
        { userId: "admin" },
        { deleteOrphans: true }
      )
    ).rejects.toMatchObject({ code: "STORAGE_DELETION_DISABLED" });
    expect(deps.jobQueue.sent).toHaveLength(0);
  });
});
