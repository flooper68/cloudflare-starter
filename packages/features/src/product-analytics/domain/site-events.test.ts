import { describe, expect, it } from "vitest";

import {
  docsPageViewedEvent,
  siteCtaClickedEvent,
  sitePageScrolledEvent,
  sitePageViewedEvent,
} from "./site-events";

describe("site events", () => {
  it("are anonymous site events, never app or client events", () => {
    for (const event of [
      sitePageViewedEvent,
      sitePageScrolledEvent,
      siteCtaClickedEvent,
      docsPageViewedEvent,
    ]) {
      expect(event.site).toBe(true);
      expect(event.client).toBe(false);
    }
  });

  it("take a page view with only the referring host", () => {
    expect(
      sitePageViewedEvent.properties.safeParse({
        page: "home",
        entry: "yes",
        referrer_host: "news.ycombinator.com",
        utm_source: "newsletter",
      }).success
    ).toBe(true);
    expect(
      sitePageViewedEvent.properties.safeParse({
        page: "home",
        entry: "yes",
        referrer_host: "https://example.com/path?q=1",
        utm_source: "",
      }).success
    ).toBe(false);
  });

  it("take ids, never free text", () => {
    expect(
      siteCtaClickedEvent.properties.safeParse({
        cta: "demo",
        placement: "hero",
        entry: "yes",
        repeat: "no",
      }).success
    ).toBe(true);
    expect(
      siteCtaClickedEvent.properties.safeParse({
        cta: "Try the demo app",
        placement: "hero",
        entry: "yes",
        repeat: "no",
      }).success
    ).toBe(false);
  });

  it("take only quarter marks of the scroll depth", () => {
    expect(
      sitePageScrolledEvent.properties.safeParse({ page: "home", depth: 50 })
        .success
    ).toBe(true);
    expect(
      sitePageScrolledEvent.properties.safeParse({ page: "home", depth: 42 })
        .success
    ).toBe(false);
  });
});
