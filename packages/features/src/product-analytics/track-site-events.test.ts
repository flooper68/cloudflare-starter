import { describe, expect, it } from "vitest";

import { createMemoryProductAnalytics } from "../platform";
import { createEventCatalog, siteCtaClickedEvent } from "./domain";
import { trackSiteEvents } from "./track-site-events";

const catalog = createEventCatalog([siteCtaClickedEvent]);

describe("trackSiteEvents", () => {
  it("tracks the batch with no user and no workspace, whatever the context says", () => {
    const analytics = createMemoryProductAnalytics();
    expect(
      trackSiteEvents(
        { analytics },
        {
          userId: "user-ada",
          workspaceId: "ws-acme",
          environment: "local",
          release: "local",
          source: "http",
        },
        {
          catalog,
          batch: {
            events: [
              {
                event: "site.cta_clicked",
                properties: { cta: "demo", placement: "hero" },
              },
            ],
          },
        }
      )
    ).toEqual({ tracked: 1 });
    expect(analytics.recorded).toEqual([
      expect.objectContaining({
        event: "site.cta_clicked",
        properties: { cta: "demo", placement: "hero" },
        context: expect.objectContaining({ userId: null, workspaceId: null }),
      }),
    ]);
  });

  it("tracks nothing when one event is refused", () => {
    const analytics = createMemoryProductAnalytics();
    expect(() =>
      trackSiteEvents(
        { analytics },
        {
          userId: null,
          workspaceId: null,
          environment: "local",
          release: "local",
          source: "http",
        },
        {
          catalog,
          batch: {
            events: [
              {
                event: "site.cta_clicked",
                properties: { cta: "demo", placement: "hero" },
              },
              { event: "app.page_viewed", properties: { route: "/app" } },
            ],
          },
        }
      )
    ).toThrow(/not a site event/);
    expect(analytics.recorded).toEqual([]);
  });
});
