import { describe, expect, it } from "vitest";

import { toAuditEvent } from "./audit-record";

describe("toAuditEvent", () => {
  it("groups actor and target and formats the time as ISO 8601", () => {
    expect(
      toAuditEvent({
        id: "evt-1",
        occurredAt: new Date("2026-10-28T12:00:00.000Z"),
        action: "auth.sign_in",
        outcome: "success",
        actorUserId: "user-ada",
        actorKind: "user",
        impersonatorUserId: null,
        targetType: "user",
        targetId: "user-ada",
        workspaceId: null,
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
        source: "http",
        ip: "203.0.113.7",
        metadata: { method: "password" },
      })
    ).toEqual({
      id: "evt-1",
      occurredAt: "2026-10-28T12:00:00.000Z",
      action: "auth.sign_in",
      outcome: "success",
      actor: { kind: "user", userId: "user-ada", impersonatorUserId: null },
      target: { type: "user", id: "user-ada" },
      workspaceId: null,
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      source: "http",
      ip: "203.0.113.7",
      metadata: { method: "password" },
    });
  });
});
