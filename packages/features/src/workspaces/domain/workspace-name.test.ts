import { describe, expect, it } from "vitest";

import { personalWorkspaceId, workspaceNameSchema } from "./workspace-name";

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

describe("personalWorkspaceId", () => {
  it("is the same for the same user and differs between users", () => {
    expect(personalWorkspaceId("user-ada")).toBe("personal-user-ada");
    expect(personalWorkspaceId("user-ada")).toBe(
      personalWorkspaceId("user-ada")
    );
    expect(personalWorkspaceId("user-alan")).not.toBe(
      personalWorkspaceId("user-ada")
    );
  });
});
