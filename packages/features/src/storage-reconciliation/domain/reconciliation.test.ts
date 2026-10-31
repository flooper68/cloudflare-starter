import { describe, expect, it } from "vitest";
import {
  effectiveReconciliationMode,
  isOldStorageObject,
  reconciliationPayload,
  STORAGE_GRACE_MS,
} from "./reconciliation";

describe("storage reconciliation policy", () => {
  it("keeps new objects and objects exactly at the 24 hour cutoff", () => {
    const now = new Date("2026-10-31T12:00:00Z");
    expect(
      isOldStorageObject(new Date(now.getTime() - STORAGE_GRACE_MS), now)
    ).toBe(false);
    expect(
      isOldStorageObject(new Date(now.getTime() - STORAGE_GRACE_MS - 1), now)
    ).toBe(true);
    expect(isOldStorageObject(new Date(now.getTime() + 100), now)).toBe(false);
  });
  it("a setting change never upgrades a queued report and disables scheduled work", () => {
    expect(
      effectiveReconciliationMode("delete", {
        mode: "report",
        trigger: "manual",
      })
    ).toBe("report");
    expect(
      effectiveReconciliationMode("report", {
        mode: "delete",
        trigger: "manual",
      })
    ).toBe("report");
    expect(
      effectiveReconciliationMode("off", {
        mode: "delete",
        trigger: "scheduled",
      })
    ).toBe(null);
    expect(
      effectiveReconciliationMode("off", { mode: "report", trigger: "manual" })
    ).toBe("report");
  });
  it("validates queued prefixes and timestamps", () => {
    const p = {
      runId: "00000000-0000-4000-8000-000000000001",
      mode: "report",
      trigger: "manual",
      prefix: "users/",
      asOf: "2026-10-31T12:00:00.000Z",
    };
    expect(reconciliationPayload.safeParse(p).success).toBe(true);
    expect(
      reconciliationPayload.safeParse({ ...p, prefix: "exports/" }).success
    ).toBe(false);
    expect(reconciliationPayload.safeParse({ ...p, cursor: "" }).success).toBe(
      false
    );
  });
});
