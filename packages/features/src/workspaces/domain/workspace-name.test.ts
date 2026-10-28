import { describe, expect, it } from "vitest";

import { workspaceNameSchema } from "./workspace-name";

describe("workspaceNameSchema", () => {
  it("trims and accepts 1 to 80 characters", () => {
    expect(workspaceNameSchema.parse("  Acme Robotics ")).toBe("Acme Robotics");
    expect(workspaceNameSchema.parse("x".repeat(80))).toHaveLength(80);
  });

  it("rejects blank and overlong names", () => {
    expect(workspaceNameSchema.safeParse("   ").success).toBe(false);
    expect(workspaceNameSchema.safeParse("x".repeat(81)).success).toBe(false);
  });
});
