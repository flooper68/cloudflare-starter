import { describe, expect, it } from "vitest";

import { describeProductAnalyticsContract } from "../../ports/product-analytics.contract";
import { createMemoryProductAnalytics } from "./memory-product-analytics";

describeProductAnalyticsContract("memory", () => {
  const analytics = createMemoryProductAnalytics();
  return {
    analytics,
    delivered: () =>
      analytics.recorded.map((call) => ({
        event: call.event,
        user: call.context.userId,
        workspace: call.context.workspaceId,
        properties: call.properties,
      })),
  };
});

describe("memory product analytics", () => {
  it("records the raw context and says why it dropped a call", () => {
    const analytics = createMemoryProductAnalytics();
    const context = {
      userId: "user-ada",
      workspaceId: "ws-acme",
      environment: "local",
      release: "local",
      source: "http" as const,
    };
    analytics.track(
      {
        event: "files.uploaded",
        properties: { content_category: "text", size_bytes: 10 },
        layout: { strings: ["content_category"], numbers: ["size_bytes"] },
      },
      context
    );
    analytics.track(
      {
        event: "Bad Name",
        properties: {},
        layout: { strings: [], numbers: [] },
      },
      context
    );
    expect(analytics.recorded).toEqual([
      expect.objectContaining({
        kind: "track",
        event: "files.uploaded",
        context,
      }),
    ]);
    expect(analytics.dropped).toEqual([
      { event: "Bad Name", reason: expect.stringMatching(/not/) },
    ]);
  });
});
