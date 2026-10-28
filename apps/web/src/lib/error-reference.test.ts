import { describe, expect, it } from "vitest";

import { errorReference } from "./error-reference";

describe("errorReference", () => {
  it("reads the reference of a tRPC client error", () => {
    expect(
      errorReference({
        message: "x",
        data: { code: "INTERNAL_SERVER_ERROR", reference: "req-1" },
      })
    ).toBe("req-1");
  });

  it("reads the reference of an HTTP route's JSON error body", () => {
    expect(
      errorReference({ error: "Internal error", reference: "req-2" })
    ).toBe("req-2");
  });

  it("has none for expected errors and non-objects", () => {
    expect(errorReference({ data: { code: "BAD_REQUEST" } })).toBeUndefined();
    expect(errorReference({ data: null })).toBeUndefined();
    expect(errorReference(new Error("x"))).toBeUndefined();
    expect(errorReference("x")).toBeUndefined();
    expect(errorReference(null)).toBeUndefined();
  });
});
