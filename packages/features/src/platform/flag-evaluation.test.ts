import { describe, expect, it } from "vitest";

import {
  evaluateStoredFlag,
  FLAG_BUCKETS,
  flagBucket,
} from "./flag-evaluation";
import type { FlagContext, StoredFlag } from "./ports";

const context = (overrides: Partial<FlagContext> = {}): FlagContext => ({
  targetingKey: "ws-ada",
  userId: "user-ada",
  workspaceId: "ws-ada",
  plan: null,
  environment: "production",
  ...overrides,
});

const flag = (overrides: Partial<StoredFlag> = {}): StoredFlag => ({
  key: "upload-demo-presigned",
  enabled: true,
  fallthrough: null,
  rules: [],
  updatedAt: "2026-10-28T12:00:00.000Z",
  updatedBy: "user-grace",
  ...overrides,
});

const evaluate = (
  stored: StoredFlag | undefined,
  ctx: FlagContext = context(),
  defaultValue: boolean = true
) =>
  evaluateStoredFlag(
    stored,
    "boolean",
    "upload-demo-presigned",
    defaultValue,
    ctx
  );

describe("evaluateStoredFlag", () => {
  it.each([
    {
      name: "missing flag → default, FLAG_NOT_FOUND",
      stored: undefined,
      ctx: context(),
      expected: { value: true, reason: "ERROR", errorCode: "FLAG_NOT_FOUND" },
    },
    {
      name: "disabled → default, DISABLED, rules ignored",
      stored: flag({
        enabled: false,
        fallthrough: false,
        rules: [{ kind: "workspace", workspaceId: "ws-ada", value: false }],
      }),
      ctx: context(),
      expected: { value: true, reason: "DISABLED", variant: "disabled" },
    },
    {
      name: "no rules, fallthrough set → fallthrough, STATIC",
      stored: flag({ fallthrough: false }),
      ctx: context(),
      expected: { value: false, reason: "STATIC", variant: "fallthrough" },
    },
    {
      name: "no fallthrough → default, DEFAULT",
      stored: flag(),
      ctx: context(),
      expected: { value: true, reason: "DEFAULT", variant: "default" },
    },
    {
      name: "workspace rule matches → TARGETING_MATCH",
      stored: flag({
        fallthrough: true,
        rules: [{ kind: "workspace", workspaceId: "ws-ada", value: false }],
      }),
      ctx: context(),
      expected: {
        value: false,
        reason: "TARGETING_MATCH",
        variant: "rule-0",
        flagMetadata: { ruleIndex: 0, ruleKind: "workspace" },
      },
    },
    {
      name: "workspace rule for another workspace → fallthrough, DEFAULT",
      stored: flag({
        fallthrough: true,
        rules: [{ kind: "workspace", workspaceId: "ws-other", value: false }],
      }),
      ctx: context(),
      expected: { value: true, reason: "DEFAULT", variant: "fallthrough" },
    },
    {
      name: "plan rule matches → TARGETING_MATCH",
      stored: flag({
        rules: [{ kind: "plan", planId: "business", value: false }],
      }),
      ctx: context({ plan: "business" }),
      expected: { value: false, reason: "TARGETING_MATCH" },
    },
    {
      name: "plan rule without a plan (plans not built yet) → no match",
      stored: flag({
        rules: [{ kind: "plan", planId: "business", value: false }],
      }),
      ctx: context({ plan: null }),
      expected: { value: true, reason: "DEFAULT" },
    },
    {
      name: "percentage 100 % → SPLIT",
      stored: flag({
        rules: [{ kind: "percentage", percentageBp: 10_000, value: false }],
      }),
      ctx: context(),
      expected: { value: false, reason: "SPLIT", variant: "rule-0" },
    },
    {
      name: "percentage 0 % → no match",
      stored: flag({
        rules: [{ kind: "percentage", percentageBp: 0, value: false }],
      }),
      ctx: context(),
      expected: { value: true, reason: "DEFAULT" },
    },
    {
      name: "percentage without a targeting key → no match",
      stored: flag({
        rules: [{ kind: "percentage", percentageBp: 10_000, value: false }],
      }),
      ctx: context({ targetingKey: null }),
      expected: { value: true, reason: "DEFAULT" },
    },
    {
      name: "first matching rule wins",
      stored: flag({
        rules: [
          { kind: "workspace", workspaceId: "ws-other", value: true },
          { kind: "percentage", percentageBp: 10_000, value: false },
          { kind: "workspace", workspaceId: "ws-ada", value: true },
        ],
      }),
      ctx: context(),
      expected: { value: false, reason: "SPLIT", variant: "rule-1" },
    },
    {
      name: "matching rule of another type → default, TYPE_MISMATCH",
      stored: flag({
        rules: [{ kind: "workspace", workspaceId: "ws-ada", value: "on" }],
      }),
      ctx: context(),
      expected: { value: true, reason: "ERROR", errorCode: "TYPE_MISMATCH" },
    },
    {
      name: "fallthrough of another type → default, TYPE_MISMATCH",
      stored: flag({ fallthrough: 1 }),
      ctx: context(),
      expected: { value: true, reason: "ERROR", errorCode: "TYPE_MISMATCH" },
    },
  ])("$name", ({ stored, ctx, expected }) => {
    expect(evaluate(stored, ctx)).toMatchObject({
      flagKey: "upload-demo-presigned",
      ...expected,
    });
  });

  it("evaluates string and number flags with the same rules", () => {
    expect(
      evaluateStoredFlag(
        flag({ key: "list-layout", fallthrough: "cards" }),
        "string",
        "list-layout",
        "table",
        context()
      )
    ).toMatchObject({ value: "cards", reason: "STATIC" });
    expect(
      evaluateStoredFlag(
        flag({
          key: "page-size",
          rules: [{ kind: "plan", planId: "team", value: 100 }],
        }),
        "number",
        "page-size",
        25,
        context({ plan: "team" })
      )
    ).toMatchObject({ value: 100, reason: "TARGETING_MATCH" });
  });
});

describe("flagBucket", () => {
  it("is FNV-1a 32 of key:targetingKey mod 10 000, pinned", () => {
    // Reference values computed independently (0xb7264ca8 and 0x9caf83e1). Changing the
    // hash moves every workspace between rollout groups: never change it silently.
    expect(flagBucket("foo", "bar")).toBe(0xb7264ca8 % 10_000);
    expect(flagBucket("upload-demo-presigned", "ws-ada")).toBe(8257);
    expect(flagBucket("upload-demo-presigned", "ws-ada")).toBe(
      flagBucket("upload-demo-presigned", "ws-ada")
    );
  });

  it("stays in range and splits 10 000 ids within ±2 % of the rollout", () => {
    const ids = Array.from({ length: 10_000 }, (_, i) => `ws-${i}`);
    for (const percentageBp of [1000, 2500, 5000, 9000]) {
      const inside = ids.filter(
        (id) => flagBucket("upload-demo-presigned", id) < percentageBp
      ).length;
      expect(
        Math.abs(inside / ids.length - percentageBp / FLAG_BUCKETS)
      ).toBeLessThanOrEqual(0.02);
    }
    for (const id of ids.slice(0, 100)) {
      const bucket = flagBucket("upload-demo-presigned", id);
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(FLAG_BUCKETS);
    }
  });

  it("salts by flag key, so two rollouts do not pick the same ids", () => {
    const ids = Array.from({ length: 1000 }, (_, i) => `ws-${i}`);
    const a = ids.filter((id) => flagBucket("flag-a", id) < 1000);
    const b = ids.filter((id) => flagBucket("flag-b", id) < 1000);
    expect(a).not.toEqual(b);
  });
});
