/**
 * Contract every ProductAnalytics adapter passes. Each adapter has a `*.contract.test.ts`
 * (or `.contract.integration.test.ts` when it needs workerd) that calls this suite.
 */
import { describe, expect, it } from "vitest";

import {
  ANALYTICS_LIMITS,
  type AnalyticsEventLayout,
  type AnalyticsPropertyValue,
  IDENTIFY_EVENT,
} from "../../kernel";
import type {
  AnalyticsContext,
  IdentifyTraits,
  ProductAnalytics,
  TrackedEvent,
} from "./product-analytics";

/** One call as the adapter delivered it, read back from where it went. */
export interface DeliveredAnalytics {
  readonly event: string;
  /** The user's key as delivered (the id, or a pseudonym); null when anonymous. */
  readonly user: string | null;
  readonly workspace: string | null;
  readonly properties: Readonly<Record<string, AnalyticsPropertyValue>>;
}

export interface ProductAnalyticsHarness {
  /** A fresh adapter instance: one unit of work. */
  readonly analytics: ProductAnalytics;
  /** What was delivered so far, or null when the adapter delivers nothing (noop). */
  delivered(): readonly DeliveredAnalytics[] | null;
}

const uploaded: TrackedEvent = {
  event: "contract.file_uploaded",
  properties: { content_category: "image", size_bytes: 2048 },
  layout: { strings: ["content_category"], numbers: ["size_bytes"] },
};

const traits: IdentifyTraits = {
  traits: { role: "owner", workspace_size: "2-5" },
  layout: { strings: ["role", "workspace_size"], numbers: [] },
};

/** The layouts the suite sends, by event name, for adapters that store by slot. */
export const CONTRACT_EVENT_LAYOUTS: ReadonlyMap<string, AnalyticsEventLayout> =
  new Map([
    [uploaded.event, uploaded.layout],
    [IDENTIFY_EVENT, traits.layout],
  ]);

const context = (overrides: Partial<AnalyticsContext> = {}) => ({
  userId: "user-ada",
  workspaceId: "ws-acme",
  environment: "local",
  release: "local",
  source: "http" as const,
  ...overrides,
});

export function describeProductAnalyticsContract(
  name: string,
  makeHarness: () => ProductAnalyticsHarness | Promise<ProductAnalyticsHarness>
): void {
  describe(`ProductAnalytics contract: ${name}`, () => {
    it("delivers a tracked event with its properties", async () => {
      const harness = await makeHarness();
      harness.analytics.track(uploaded, context());
      const delivered = harness.delivered();
      if (delivered === null) return;
      expect(delivered).toEqual([
        expect.objectContaining({
          event: uploaded.event,
          properties: uploaded.properties,
        }),
      ]);
      expect(delivered[0]?.user).not.toBeNull();
      expect(delivered[0]?.workspace).not.toBeNull();
    });

    it("keys the same user the same way, others differently, anonymous as null", async () => {
      const harness = await makeHarness();
      harness.analytics.track(uploaded, context());
      harness.analytics.track(uploaded, context());
      harness.analytics.track(uploaded, context({ userId: "user-grace" }));
      harness.analytics.track(
        uploaded,
        context({ userId: null, workspaceId: null })
      );
      const delivered = harness.delivered();
      if (delivered === null) return;
      const [first, again, other, anonymous] = delivered;
      expect(again?.user).toBe(first?.user);
      expect(other?.user).not.toBe(first?.user);
      expect(anonymous?.user).toBeNull();
      expect(anonymous?.workspace).toBeNull();
    });

    it("delivers identify as the $identify event with the traits", async () => {
      const harness = await makeHarness();
      harness.analytics.identify(context(), traits);
      const delivered = harness.delivered();
      if (delivered === null) return;
      expect(delivered).toEqual([
        expect.objectContaining({
          event: IDENTIFY_EVENT,
          properties: traits.traits,
        }),
      ]);
    });

    it("drops an event over the limits without throwing", async () => {
      const harness = await makeHarness();
      const strings = Array.from(
        { length: ANALYTICS_LIMITS.strings + 1 },
        (_, i) => `s${i}`
      );
      expect(() =>
        harness.analytics.track(
          {
            event: "contract.too_wide",
            properties: Object.fromEntries(strings.map((s) => [s, "x"])),
            layout: { strings, numbers: [] },
          },
          context()
        )
      ).not.toThrow();
      expect(() =>
        harness.analytics.track(
          { ...uploaded, event: `contract.${"x".repeat(100)}` },
          context()
        )
      ).not.toThrow();
      expect(harness.delivered() ?? []).toEqual([]);
    });

    it(`delivers at most ${ANALYTICS_LIMITS.pointsPerInvocation} calls per unit of work`, async () => {
      const harness = await makeHarness();
      expect(() => {
        for (let i = 0; i < ANALYTICS_LIMITS.pointsPerInvocation + 5; i++) {
          harness.analytics.track(uploaded, context());
        }
        harness.analytics.identify(context(), traits);
      }).not.toThrow();
      const delivered = harness.delivered();
      if (delivered === null) return;
      expect(delivered).toHaveLength(ANALYTICS_LIMITS.pointsPerInvocation);
    });
  });
}
