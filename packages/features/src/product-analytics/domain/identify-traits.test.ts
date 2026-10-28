import { describe, expect, it } from "vitest";

import { layoutProblems } from "./event-rules";
import {
  IDENTIFY_TRAITS_LAYOUT,
  identifyTraitsSchema,
  workspaceSizeBucket,
} from "./identify-traits";

describe("workspaceSizeBucket", () => {
  it.each([
    [0, "1"],
    [1, "1"],
    [2, "2-5"],
    [5, "2-5"],
    [6, "6-20"],
    [20, "6-20"],
    [21, "21-100"],
    [100, "21-100"],
    [101, "101+"],
  ])("%i members → %s", (members, bucket) => {
    expect(workspaceSizeBucket(members)).toBe(bucket);
  });
});

describe("identify traits", () => {
  it("accepts the catalog traits only", () => {
    expect(
      identifyTraitsSchema.safeParse({
        role: "owner",
        workspace_size: "2-5",
        plan: "pro",
      }).success
    ).toBe(true);
    expect(
      identifyTraitsSchema.safeParse({
        role: "owner",
        workspace_size: "2-5",
        plan: "pro",
        email: "ada@example.test",
      }).success
    ).toBe(false);
    expect(
      identifyTraitsSchema.safeParse({
        role: "owner",
        workspace_size: "3",
        plan: "pro",
      }).success
    ).toBe(false);
    expect(
      identifyTraitsSchema.safeParse({
        role: "owner",
        workspace_size: "1",
        plan: null,
      }).success
    ).toBe(false);
  });

  it("lays out every trait, none of them personal data", () => {
    expect(layoutProblems(IDENTIFY_TRAITS_LAYOUT)).toEqual([]);
    expect([...IDENTIFY_TRAITS_LAYOUT.strings].sort()).toEqual(
      Object.keys(identifyTraitsSchema.shape).sort()
    );
  });
});
