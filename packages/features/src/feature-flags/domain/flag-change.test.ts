import { describe, expect, it } from "vitest";

import { FlagValueTypeError, UnknownFlagError } from "./errors";
import {
  assertFlagValueType,
  flagRulesSchema,
  flagUpdateSchema,
  requireFlagDefinition,
} from "./flag-change";

describe("flag changes", () => {
  it("requires a catalog flag", () => {
    expect(requireFlagDefinition("upload-demo-presigned").type).toBe("boolean");
    expect(() => requireFlagDefinition("dark-launch")).toThrow(
      UnknownFlagError
    );
  });

  it("accepts values of the flag's type, or null for the catalog default", () => {
    const definition = requireFlagDefinition("upload-demo-presigned");
    expect(() =>
      assertFlagValueType("upload-demo-presigned", definition, false)
    ).not.toThrow();
    expect(() =>
      assertFlagValueType("upload-demo-presigned", definition, null)
    ).not.toThrow();
    expect(() =>
      assertFlagValueType("upload-demo-presigned", definition, "true")
    ).toThrow(FlagValueTypeError);
  });

  it("validates rules: known kinds, ids, basis points 0–10000", () => {
    expect(
      flagRulesSchema.safeParse({
        key: "upload-demo-presigned",
        rules: [
          { kind: "workspace", workspaceId: "ws-1", value: true },
          { kind: "plan", planId: "business", value: true },
          { kind: "percentage", percentageBp: 5000, value: false },
        ],
      }).success
    ).toBe(true);
    for (const rule of [
      { kind: "percentage", percentageBp: 10_001, value: true },
      { kind: "percentage", percentageBp: 12.5, value: true },
      { kind: "workspace", workspaceId: " ", value: true },
      { kind: "plan", value: true },
      { kind: "country", country: "CZ", value: true },
      { kind: "workspace", workspaceId: "ws-1", value: { on: true } },
    ]) {
      expect(
        flagRulesSchema.safeParse({
          key: "upload-demo-presigned",
          rules: [rule],
        }).success
      ).toBe(false);
    }
  });

  it("validates updates: an explicit switch and fallthrough", () => {
    expect(
      flagUpdateSchema.safeParse({
        key: "upload-demo-presigned",
        enabled: true,
        fallthrough: null,
      }).success
    ).toBe(true);
    expect(
      flagUpdateSchema.safeParse({
        key: "upload-demo-presigned",
        enabled: true,
      }).success
    ).toBe(false);
  });
});
