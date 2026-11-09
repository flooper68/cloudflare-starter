import { describe, expect, it } from "vitest";
import { z } from "zod";

import { defineEvent } from "../../kernel";
import { pageViewedEvent } from "./analytics-events";
import {
  clientBatchSchema,
  parseClientBatch,
  parseSiteBatch,
  siteBatchSchema,
} from "./client-batch";
import { createEventCatalog } from "./event-catalog";
import { siteCtaClickedEvent } from "./site-events";

const serverOnly = defineEvent(
  "files.uploaded",
  { strings: ["content_category"], numbers: [] },
  z.object({ content_category: z.string() }),
  { client: false, description: "A file was stored" }
);
const catalog = createEventCatalog([pageViewedEvent, serverOnly]);

const view = (route: string) => ({
  event: "app.page_viewed",
  properties: { route },
});

describe("clientBatchSchema", () => {
  it("accepts 1 to 20 events, properties defaulting to none", () => {
    expect(
      clientBatchSchema.safeParse({ events: [view("/app")] }).success
    ).toBe(true);
    expect(
      clientBatchSchema.parse({ events: [{ event: "app.page_viewed" }] })
    ).toEqual({ events: [{ event: "app.page_viewed", properties: {} }] });
    expect(clientBatchSchema.safeParse({ events: [] }).success).toBe(false);
    expect(
      clientBatchSchema.safeParse({
        events: Array.from({ length: 21 }, () => view("/app")),
      }).success
    ).toBe(false);
  });

  it("refuses objects and arrays as property values", () => {
    expect(
      clientBatchSchema.safeParse({
        events: [{ event: "app.page_viewed", properties: { route: ["/app"] } }],
      }).success
    ).toBe(false);
  });
});

describe("parseClientBatch", () => {
  it("returns each event with its definition and parsed properties", () => {
    expect(
      parseClientBatch(catalog, { events: [view("/app/dashboard")] })
    ).toEqual([
      { definition: pageViewedEvent, properties: { route: "/app/dashboard" } },
    ]);
  });

  it("refuses the whole batch for an unknown or server-only event", () => {
    for (const event of ["app.unknown", "files.uploaded"]) {
      expect(() =>
        parseClientBatch(catalog, {
          events: [view("/app"), { event, properties: {} }],
        })
      ).toThrow(
        expect.objectContaining({
          kind: "invalid_input",
          code: "INVALID_ANALYTICS_EVENT",
          message: `events[1]: "${event}" is not a client event of the analytics catalog`,
        })
      );
    }
  });

  it("refuses properties the event's schema rejects", () => {
    expect(() =>
      parseClientBatch(catalog, { events: [view("https://a.test/?q=1")] })
    ).toThrow("events[0]: invalid properties for app.page_viewed");
  });
});

describe("site batches", () => {
  const siteCatalog = createEventCatalog([
    pageViewedEvent,
    serverOnly,
    siteCtaClickedEvent,
  ]);
  const click = {
    event: "site.cta_clicked",
    properties: { cta: "demo", placement: "hero" },
  };

  it("accepts 1 to 10 events", () => {
    expect(siteBatchSchema.safeParse({ events: [click] }).success).toBe(true);
    expect(
      siteBatchSchema.safeParse({
        events: Array.from({ length: 11 }, () => click),
      }).success
    ).toBe(false);
  });

  it("parses site events with their properties", () => {
    expect(
      parseSiteBatch(siteCatalog, { events: [click] }).map((event) => [
        event.definition.name,
        event.properties,
      ])
    ).toEqual([["site.cta_clicked", { cta: "demo", placement: "hero" }]]);
  });

  it.each([
    ["an app event", view("/app")],
    ["a server event", { event: "files.uploaded", properties: {} }],
    ["an unknown event", { event: "site.nope", properties: {} }],
    [
      "bad properties",
      { event: "site.cta_clicked", properties: { cta: "Try it!" } },
    ],
  ])("refuses the whole batch for %s", (_, event) => {
    expect(() =>
      parseSiteBatch(siteCatalog, { events: [click, event] })
    ).toThrow(/events\[1\]/);
  });
});
