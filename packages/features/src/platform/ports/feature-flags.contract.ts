/**
 * The FeatureFlags contract: every adapter's `*.contract.test.ts` runs this suite against
 * it. Evaluation results follow OpenFeature (reasons, error codes). Adapters with a store
 * (D1, memory) also run the targeting cases. Test support only (not exported from the
 * barrel, not bundled).
 */
import { describe, expect, it } from "vitest";

import type {
  FeatureFlagStore,
  FeatureFlags,
  FlagContext,
  FlagReason,
} from "./feature-flags";

export interface FeatureFlagsHarness {
  readonly flags: FeatureFlags;
  /** The adapter's store. Omit for adapters without one (noop, vendor providers). */
  readonly store?: FeatureFlagStore;
}

const REASONS: readonly FlagReason[] = [
  "STATIC",
  "DEFAULT",
  "TARGETING_MATCH",
  "SPLIT",
  "CACHED",
  "DISABLED",
  "UNKNOWN",
  "STALE",
  "ERROR",
];

export function contractFlagContext(
  overrides: Partial<FlagContext> = {}
): FlagContext {
  return {
    targetingKey: "ws-ada",
    userId: "user-ada",
    workspaceId: "ws-ada",
    plan: null,
    environment: "local",
    ...overrides,
  };
}

let sequence = 0;
/** A key no other test in the file uses (storage is shared within a test file). */
const freshKey = () => `contract-flag-${++sequence}`;

export function describeFeatureFlagsContract(
  name: string,
  makeHarness: () => FeatureFlagsHarness
): void {
  describe(`${name} satisfies the FeatureFlags contract`, () => {
    it("returns the caller's default for a flag it does not know, with OpenFeature details", async () => {
      const { flags } = makeHarness();
      const context = contractFlagContext();
      const key = freshKey();
      const boolean = await flags.getBooleanDetails(key, true, context);
      const text = await flags.getStringDetails(key, "cards", context);
      const number = await flags.getNumberDetails(key, 25, context);
      for (const [details, value] of [
        [boolean, true],
        [text, "cards"],
        [number, 25],
      ] as const) {
        expect(details.flagKey).toBe(key);
        expect(details.value).toBe(value);
        expect(REASONS).toContain(details.reason);
        expect(details.flagMetadata).toBeTypeOf("object");
      }
    });

    it("never throws, whatever the context holds", async () => {
      const { flags } = makeHarness();
      await expect(
        flags.getBooleanDetails(
          "",
          false,
          contractFlagContext({
            targetingKey: null,
            userId: null,
            workspaceId: null,
          })
        )
      ).resolves.toMatchObject({ value: false });
    });

    if (!makeHarness().store) return;
    const withStore = () => {
      const harness = makeHarness();
      return { flags: harness.flags, store: harness.store as FeatureFlagStore };
    };

    it("resolves a flag without rules to its fallthrough value (STATIC)", async () => {
      const { flags, store } = withStore();
      const key = freshKey();
      await store.update(key, { enabled: true, fallthrough: "table" }, "admin");
      expect(
        await flags.getStringDetails(key, "cards", contractFlagContext())
      ).toMatchObject({ value: "table", reason: "STATIC" });
    });

    it("resolves a disabled flag to the caller's default (DISABLED)", async () => {
      const { flags, store } = withStore();
      const key = freshKey();
      await store.update(key, { enabled: false, fallthrough: false }, "admin");
      expect(
        await flags.getBooleanDetails(key, true, contractFlagContext())
      ).toMatchObject({ value: true, reason: "DISABLED" });
    });

    it("matches workspace and plan rules in order (TARGETING_MATCH), else falls through (DEFAULT)", async () => {
      const { flags, store } = withStore();
      const key = freshKey();
      await store.update(key, { enabled: true, fallthrough: 10 }, "admin");
      await store.setRules(
        key,
        [
          { kind: "workspace", workspaceId: "ws-ada", value: 50 },
          { kind: "plan", planId: "business", value: 100 },
          { kind: "workspace", workspaceId: "ws-ada", value: 999 },
        ],
        "admin"
      );
      expect(
        await flags.getNumberDetails(key, 0, contractFlagContext())
      ).toMatchObject({ value: 50, reason: "TARGETING_MATCH" });
      expect(
        await flags.getNumberDetails(
          key,
          0,
          contractFlagContext({ workspaceId: "ws-other", plan: "business" })
        )
      ).toMatchObject({ value: 100, reason: "TARGETING_MATCH" });
      expect(
        await flags.getNumberDetails(
          key,
          0,
          contractFlagContext({ workspaceId: "ws-other" })
        )
      ).toMatchObject({ value: 10, reason: "DEFAULT" });
    });

    it("assigns percentage rules by targeting key (SPLIT) and never without one", async () => {
      const { flags, store } = withStore();
      const all = freshKey();
      const none = freshKey();
      await store.update(all, { enabled: true, fallthrough: false }, "admin");
      await store.setRules(
        all,
        [{ kind: "percentage", percentageBp: 10_000, value: true }],
        "admin"
      );
      await store.update(none, { enabled: true, fallthrough: false }, "admin");
      await store.setRules(
        none,
        [{ kind: "percentage", percentageBp: 0, value: true }],
        "admin"
      );
      expect(
        await flags.getBooleanDetails(all, false, contractFlagContext())
      ).toMatchObject({ value: true, reason: "SPLIT" });
      expect(
        await flags.getBooleanDetails(none, false, contractFlagContext())
      ).toMatchObject({ value: false, reason: "DEFAULT" });
      expect(
        await flags.getBooleanDetails(
          all,
          false,
          contractFlagContext({ targetingKey: null })
        )
      ).toMatchObject({ value: false, reason: "DEFAULT" });
    });

    it("returns the default with TYPE_MISMATCH when the stored value has another type", async () => {
      const { flags, store } = withStore();
      const key = freshKey();
      await store.update(key, { enabled: true, fallthrough: "on" }, "admin");
      expect(
        await flags.getBooleanDetails(key, false, contractFlagContext())
      ).toMatchObject({
        value: false,
        reason: "ERROR",
        errorCode: "TYPE_MISMATCH",
      });
    });

    it("returns the default with FLAG_NOT_FOUND for a flag it has no configuration for", async () => {
      const { flags } = withStore();
      expect(
        await flags.getBooleanDetails(freshKey(), true, contractFlagContext())
      ).toMatchObject({
        value: true,
        reason: "ERROR",
        errorCode: "FLAG_NOT_FOUND",
      });
    });

    it("keeps rules on update and the switch on setRules, and lists what it stored", async () => {
      const { store } = withStore();
      const key = freshKey();
      await store.setRules(
        key,
        [{ kind: "workspace", workspaceId: "ws-ada", value: true }],
        "user-grace"
      );
      const created = (await store.list()).find((flag) => flag.key === key);
      expect(created).toMatchObject({
        enabled: false,
        fallthrough: null,
        updatedBy: "user-grace",
      });
      const updated = await store.update(
        key,
        { enabled: true, fallthrough: false },
        "user-ada"
      );
      expect(updated).toMatchObject({
        key,
        enabled: true,
        fallthrough: false,
        rules: [{ kind: "workspace", workspaceId: "ws-ada", value: true }],
        updatedBy: "user-ada",
      });
      expect(Number.isNaN(Date.parse(updated.updatedAt))).toBe(false);
      const replaced = await store.setRules(key, [], "user-ada");
      expect(replaced).toMatchObject({ enabled: true, rules: [] });
    });
  });
}
