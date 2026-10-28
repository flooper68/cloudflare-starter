import { describe, expect, it } from "vitest";

import {
  AUDIT_PAGE_SIZE_DEFAULT,
  AUDIT_PAGE_SIZE_MAX,
  auditQuerySchema,
  decodeAuditCursor,
  encodeAuditCursor,
} from "./audit-query";
import { InvalidAuditInputError } from "./errors";

describe("auditQuerySchema", () => {
  it("defaults the page size", () => {
    expect(auditQuerySchema.parse({})).toEqual({
      limit: AUDIT_PAGE_SIZE_DEFAULT,
    });
  });

  it("accepts every filter", () => {
    const query = {
      actorUserId: "user-ada",
      action: "auth.sign_in",
      targetType: "user",
      targetId: "user-ada",
      workspaceId: "ws-1",
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-11-01T00:00:00.000Z",
      cursor: "1793178703412:42",
      limit: 10,
    };
    expect(auditQuerySchema.parse(query)).toEqual(query);
  });

  it.each([
    { action: "user.renamed" },
    { targetType: "file" },
    { from: "yesterday" },
    { limit: 0 },
    { limit: AUDIT_PAGE_SIZE_MAX + 1 },
    { unknownFilter: "x" },
    { targetId: "user-ada" },
  ])("rejects %o", (query) => {
    expect(auditQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe("audit cursor", () => {
  it("round-trips", () => {
    const cursor = { occurredAtMs: 1793178703412, seq: 42 };
    expect(decodeAuditCursor(encodeAuditCursor(cursor))).toEqual(cursor);
  });

  it.each(["", "abc", ":7", "12:", "x1:7", "12:abc"])("rejects %j", (value) => {
    expect(() => decodeAuditCursor(value)).toThrow(InvalidAuditInputError);
  });
});
