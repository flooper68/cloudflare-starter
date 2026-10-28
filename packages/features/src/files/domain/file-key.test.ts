import { describe, expect, it } from "vitest";

import { buildFileKey } from "./file-key";

describe("buildFileKey", () => {
  it("groups files by workspace, then upload month in UTC", () => {
    expect(
      buildFileKey("ws1", "abc", new Date("2026-04-19T00:00:00.000Z"))
    ).toBe("workspaces/ws1/uploads/2026/04/abc");
    expect(
      buildFileKey("ws1", "abc", new Date("2026-12-31T23:30:00.000-02:00"))
    ).toBe("workspaces/ws1/uploads/2027/01/abc");
  });
});
