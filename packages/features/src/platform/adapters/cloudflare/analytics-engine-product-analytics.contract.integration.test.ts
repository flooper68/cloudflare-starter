import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  CONTRACT_EVENT_LAYOUTS,
  describeProductAnalyticsContract,
} from "../../ports/product-analytics.contract";
import {
  createAnalyticsEngineProductAnalytics,
  decodeAnalyticsEngineDataPoint,
  pseudonymousId,
} from "./analytics-engine-product-analytics";

// ANALYTICS_TEST (packages/features/test/wrangler.jsonc) is Miniflare's simulated
// Analytics Engine dataset: it accepts writeDataPoint and stores nothing. The recorder
// passes every point on to it, so the real binding API is exercised, and keeps a copy to
// read back.
function recordingDataset() {
  const points: AnalyticsEngineDataPoint[] = [];
  const dataset: AnalyticsEngineDataset = {
    writeDataPoint(point) {
      points.push(point ?? {});
      env.ANALYTICS_TEST.writeDataPoint(point);
    },
  };
  return { points, dataset };
}

const SECRET = "fixed-test-key-0123456789";

describeProductAnalyticsContract(
  "analytics-engine (Workers Analytics Engine binding)",
  () => {
    const { points, dataset } = recordingDataset();
    return {
      analytics: createAnalyticsEngineProductAnalytics({
        dataset,
        idSecret: SECRET,
      }),
      delivered: () =>
        points.map((point) => {
          const event = String(point.blobs?.[0] ?? "");
          const decoded = decodeAnalyticsEngineDataPoint(
            point,
            CONTRACT_EVENT_LAYOUTS.get(event)
          );
          return {
            event: decoded.event,
            user: decoded.user,
            workspace: decoded.workspace,
            properties: decoded.properties,
          };
        }),
    };
  }
);

const context = {
  userId: "user-ada",
  workspaceId: "ws-acme",
  environment: "develop",
  release: "8f2c1a4e-version",
  source: "http" as const,
};

describe("analytics-engine product analytics", () => {
  it("pseudonymizes ids with HMAC-SHA256 under the secret (first 32 hex)", () => {
    // Reference values: printf 'user-ada' | openssl dgst -sha256 -hmac '<secret>'
    expect(pseudonymousId(SECRET, "user-ada")).toBe(
      "4f23b8bc543352714349e6b835413a40"
    );
    expect(pseudonymousId(SECRET, "ws-acme")).toBe(
      "450babc90527d2da55f908ac4211e1cc"
    );
    expect(pseudonymousId("another-secret-0123456789", "user-ada")).not.toBe(
      "4f23b8bc543352714349e6b835413a40"
    );
    expect(pseudonymousId(SECRET, null)).toBe("");
  });

  it("writes the documented layout: index1 event; fixed blobs; properties in catalog order", () => {
    const { points, dataset } = recordingDataset();
    const analytics = createAnalyticsEngineProductAnalytics({
      dataset,
      idSecret: SECRET,
    });
    analytics.track(
      {
        event: "files.uploaded",
        properties: { content_category: "text", size_bytes: 2048 },
        layout: { strings: ["content_category"], numbers: ["size_bytes"] },
      },
      context
    );
    expect(points).toEqual([
      {
        indexes: ["files.uploaded"],
        blobs: [
          "files.uploaded",
          "4f23b8bc543352714349e6b835413a40",
          "450babc90527d2da55f908ac4211e1cc",
          "develop",
          "8f2c1a4e-version",
          "http",
          "text",
        ],
        doubles: [2048],
      },
    ]);
    // Without the layout, properties keep their SQL column names.
    expect(decodeAnalyticsEngineDataPoint(points[0] ?? {}).properties).toEqual({
      blob7: "text",
      double1: 2048,
    });
  });

  it("never sends a raw id, cuts long strings on a character boundary, writes null as empty", () => {
    const { points, dataset } = recordingDataset();
    createAnalyticsEngineProductAnalytics({ dataset, idSecret: SECRET }).track(
      {
        event: "app.page_viewed",
        properties: { route: "é".repeat(200), referrer: null },
        layout: { strings: ["route", "referrer"], numbers: [] },
      },
      context
    );
    const blobs = (points[0]?.blobs ?? []) as string[];
    expect(blobs).not.toContain("user-ada");
    expect(blobs).not.toContain("ws-acme");
    expect(new TextEncoder().encode(blobs[6]).length).toBe(256);
    expect(blobs[6]).toBe("é".repeat(128));
    expect(blobs[7]).toBe("");
  });

  it("reports drops and survives a failing binding", () => {
    const drops: string[] = [];
    const analytics = createAnalyticsEngineProductAnalytics({
      dataset: {
        writeDataPoint() {
          throw new Error("binding unavailable");
        },
      },
      idSecret: SECRET,
      onDrop: (event, reason) => drops.push(`${event}: ${reason}`),
    });
    expect(() =>
      analytics.identify(context, {
        traits: { role: "owner" },
        layout: { strings: ["role"], numbers: [] },
      })
    ).not.toThrow();
    expect(drops).toEqual(["$identify: binding unavailable"]);
  });
});
