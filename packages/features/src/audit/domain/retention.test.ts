import { describe, expect, it } from "vitest";

import { InvalidAuditInputError } from "./errors";
import { AUDIT_RETENTION_DAYS, auditRetentionCutoff } from "./retention";

const now = new Date("2026-10-28T12:00:00.000Z");

describe("auditRetentionCutoff", () => {
  it("is AUDIT_RETENTION_DAYS (400) days before now by default", () => {
    expect(AUDIT_RETENTION_DAYS).toBe(400);
    expect(auditRetentionCutoff(now).toISOString()).toBe(
      "2025-09-23T12:00:00.000Z"
    );
  });

  it("takes another whole number of days", () => {
    expect(auditRetentionCutoff(now, 1).toISOString()).toBe(
      "2026-10-27T12:00:00.000Z"
    );
  });

  it.each([0, -1, 1.5, Number.NaN])("rejects %s days", (days) => {
    expect(() => auditRetentionCutoff(now, days)).toThrow(
      InvalidAuditInputError
    );
  });
});
