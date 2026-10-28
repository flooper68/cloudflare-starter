import { describe, expect, it } from "vitest";
import { z } from "zod";

import { defineEvent } from "../../kernel";
import { pageViewedEvent } from "./analytics-events";
import { createEventCatalog } from "./event-catalog";

describe("createEventCatalog", () => {
  it("indexes events by name", () => {
    const catalog = createEventCatalog([pageViewedEvent]);
    expect(catalog.get("app.page_viewed")).toBe(pageViewedEvent);
  });

  it("refuses a duplicate name", () => {
    expect(() =>
      createEventCatalog([pageViewedEvent, pageViewedEvent])
    ).toThrow('Analytics event "app.page_viewed" is declared twice');
  });

  it("refuses an event with personal data in its properties", () => {
    const leaky = defineEvent(
      "auth.signed_in",
      { strings: ["email"], numbers: [] },
      z.object({ email: z.string() }),
      { client: false, description: "Signed in" }
    );
    expect(() => createEventCatalog([leaky])).toThrow(
      /looks like personal data/
    );
  });
});

describe("app.page_viewed", () => {
  it("takes a route pattern, not a URL", () => {
    const schema = pageViewedEvent.properties;
    expect(schema.safeParse({ route: "/app/members" }).success).toBe(true);
    expect(schema.safeParse({ route: "/app/files/$fileId" }).success).toBe(
      true
    );
    expect(schema.safeParse({ route: "/app/files?id=1" }).success).toBe(false);
    expect(
      schema.safeParse({ route: "https://example.test/app" }).success
    ).toBe(false);
    expect(schema.safeParse({ route: "/app", extra: 1 }).success).toBe(false);
  });
});
