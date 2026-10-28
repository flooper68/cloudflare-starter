import { describe, expect, it } from "vitest";

import { limitKey } from "./limit-key";

describe("limitKey", () => {
  it("counts a signed-in user by id for user-scoped policies", () => {
    expect(
      limitKey("mutation.user", { userId: "user-1", ip: "203.0.113.7" })
    ).toBe("mutation.user:user:user-1");
  });

  it("counts anonymous callers of a user-scoped policy by IP", () => {
    expect(limitKey("mutation.user", { userId: null, ip: "203.0.113.7" })).toBe(
      "mutation.user:ip:203.0.113.7"
    );
  });

  it("counts IP-scoped policies by IP even with a user", () => {
    expect(limitKey("mcp.ip", { userId: "user-1", ip: "2001:db8::1" })).toBe(
      "mcp.ip:ip:2001:db8::1"
    );
  });

  it("puts requests without a known IP in one shared counter", () => {
    expect(limitKey("auth.ip", { userId: null, ip: null })).toBe(
      "auth.ip:ip:unknown"
    );
  });

  it("keeps policies sharing a binding apart", () => {
    const subject = { userId: "user-1", ip: "203.0.113.7" };
    expect(limitKey("mcp.ip", subject)).not.toBe(limitKey("mcp.user", subject));
  });
});
