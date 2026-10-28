import { describe, expect, it } from "vitest";
import { z } from "zod";

import { defineEvent } from "../kernel";
import { createMemoryProductAnalytics } from "../platform";
import { trackEvent } from "./track-event";

const uploaded = defineEvent(
  "files.uploaded",
  { strings: ["content_category"], numbers: ["size_bytes"] },
  z.object({
    content_category: z.enum(["text", "pdf"]),
    size_bytes: z.number().int().nonnegative(),
  }),
  { client: false, description: "A file was stored" }
);

const context = {
  userId: "user-ada",
  workspaceId: "ws-acme",
  environment: "local",
  release: "local",
  source: "http" as const,
};

describe("trackEvent", () => {
  it("hands the event, its properties and layout to the port", () => {
    const analytics = createMemoryProductAnalytics();
    expect(
      trackEvent({ analytics }, context, uploaded, {
        content_category: "pdf",
        size_bytes: 2048,
      })
    ).toBe(true);
    expect(analytics.recorded).toEqual([
      {
        kind: "track",
        event: "files.uploaded",
        properties: { content_category: "pdf", size_bytes: 2048 },
        layout: { strings: ["content_category"], numbers: ["size_bytes"] },
        context,
      },
    ]);
  });

  it("drops an event whose properties fail the schema, without throwing", () => {
    const analytics = createMemoryProductAnalytics();
    expect(
      trackEvent({ analytics }, context, uploaded, {
        content_category: "pdf",
        size_bytes: -5,
      })
    ).toBe(false);
    expect(analytics.recorded).toEqual([]);
  });
});
