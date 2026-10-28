import { describe, expect, it } from "vitest";

import { createMemoryProductAnalytics } from "../platform";
import { createEventCatalog, pageViewedEvent } from "./domain";
import { trackClientEvents } from "./track-client-events";

const catalog = createEventCatalog([pageViewedEvent]);
const context = {
  userId: "user-ada",
  workspaceId: "ws-acme",
  environment: "local",
  release: "local",
  source: "http" as const,
};

describe("trackClientEvents", () => {
  it("tracks every event of a valid batch in order, with the caller's context", () => {
    const analytics = createMemoryProductAnalytics();
    expect(
      trackClientEvents({ analytics }, context, {
        catalog,
        batch: {
          events: [
            {
              event: "app.page_viewed",
              properties: { route: "/app/dashboard" },
            },
            { event: "app.page_viewed", properties: { route: "/app/members" } },
          ],
        },
      })
    ).toEqual({ tracked: 2 });
    expect(
      analytics.recorded.map((call) => [
        call.event,
        call.properties,
        call.context,
      ])
    ).toEqual([
      ["app.page_viewed", { route: "/app/dashboard" }, context],
      ["app.page_viewed", { route: "/app/members" }, context],
    ]);
  });

  it("tracks nothing when one event is refused", () => {
    const analytics = createMemoryProductAnalytics();
    expect(() =>
      trackClientEvents({ analytics }, context, {
        catalog,
        batch: {
          events: [
            { event: "app.page_viewed", properties: { route: "/app" } },
            { event: "files.uploaded", properties: {} },
          ],
        },
      })
    ).toThrow(expect.objectContaining({ code: "INVALID_ANALYTICS_EVENT" }));
    expect(analytics.recorded).toEqual([]);
  });
});
