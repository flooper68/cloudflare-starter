import { describe, expect, it } from "vitest";

import { WorkspaceModeError } from "./errors";
import { modeAllows, requireMode } from "./mode";

describe("workspace modes", () => {
  it("personal: a personal workspace per user, no members, no switching", () => {
    expect(modeAllows("personal", "personalWorkspace")).toBe(true);
    expect(modeAllows("personal", "members")).toBe(false);
    expect(modeAllows("personal", "create")).toBe(false);
    expect(modeAllows("personal", "switch")).toBe(false);
  });

  it("single: members and invitations in one workspace, nothing to create or switch", () => {
    expect(modeAllows("single", "members")).toBe(true);
    expect(modeAllows("single", "create")).toBe(false);
    expect(modeAllows("single", "switch")).toBe(false);
    expect(modeAllows("single", "personalWorkspace")).toBe(false);
  });

  it("multi: everything", () => {
    for (const capability of [
      "members",
      "create",
      "switch",
      "personalWorkspace",
    ] as const) {
      expect(modeAllows("multi", capability)).toBe(true);
    }
  });

  it("requireMode throws WorkspaceModeError naming the operation", () => {
    expect(() =>
      requireMode("multi", "create", "Creating a workspace")
    ).not.toThrow();
    expect(() => requireMode("personal", "members", "Inviting")).toThrow(
      new WorkspaceModeError("personal", "Inviting")
    );
  });
});
