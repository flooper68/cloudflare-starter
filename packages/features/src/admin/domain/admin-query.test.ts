import { describe, expect, it } from "vitest";

import {
  adminUserQuerySchema,
  adminWorkspaceQuerySchema,
  decodeAdminCursor,
  encodeAdminCursor,
  likePattern,
  parseAdminQuery,
} from "./admin-query";
import { InvalidAdminQueryError } from "./errors";

describe("admin list queries", () => {
  it("defaults the page size and trims the search", () => {
    expect(
      parseAdminQuery(adminUserQuerySchema, {
        search: "  grace ",
        role: "admin",
      })
    ).toEqual({ search: "grace", role: "admin", limit: 25 });
    expect(parseAdminQuery(adminWorkspaceQuerySchema, {})).toEqual({
      limit: 25,
    });
  });

  it.each([
    { role: "owner" },
    { status: "deleted" },
    { limit: 101 },
    { limit: 0 },
    { unexpected: true },
  ])("refuses %j", (input) => {
    expect(() => parseAdminQuery(adminUserQuerySchema, input)).toThrow(
      InvalidAdminQueryError
    );
  });

  it("round-trips a cursor and refuses a malformed one", () => {
    const cursor = { createdAtMs: 1793200930059, id: "user:with:colons" };
    expect(decodeAdminCursor(encodeAdminCursor(cursor))).toEqual(cursor);
    for (const bad of ["", "abc", ":id", "12:", "1x:id"]) {
      expect(() => decodeAdminCursor(bad)).toThrow(InvalidAdminQueryError);
    }
  });

  it("escapes LIKE wildcards in a search", () => {
    expect(likePattern("ada")).toBe("%ada%");
    expect(likePattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });
});
