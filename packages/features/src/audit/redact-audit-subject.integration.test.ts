import { describe, expect, it } from "vitest";
import { rows, useCaseDeps } from "../../test/fixtures";
import { recordAuditEvent } from "./record-audit-event";
import { redactAuditSubject } from "./redact-audit-subject";

describe("redactAuditSubject", () => {
  it("removes subject IP/email targets and exact email metadata while preserving unrelated events", async () => {
    const deps = useCaseDeps();
    await recordAuditEvent(
      deps,
      { ...deps.requestContext, userId: "erased", ip: "203.0.113.5" },
      {
        action: "auth.password_reset_requested",
        target: { type: "email", id: "erase@example.test" },
      }
    );
    await recordAuditEvent(
      deps,
      { ...deps.requestContext, userId: "other", ip: "203.0.113.6" },
      {
        action: "auth.password_reset_requested",
        target: { type: "email", id: "other@example.test" },
      }
    );
    await redactAuditSubject(deps, {
      userId: "erased",
      email: "erase@example.test",
    });
    expect(
      await rows(
        "SELECT target_type,target_id,ip FROM audit_events ORDER BY rowid"
      )
    ).toEqual([
      { target_type: "user", target_id: "erased", ip: null },
      {
        target_type: "email",
        target_id: "other@example.test",
        ip: "203.0.113.6",
      },
    ]);
  });
});
