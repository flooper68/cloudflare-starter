import { describe, expect, it } from "vitest";

import { contentCategory, fileUploadedEvent } from "./analytics-events";

describe("contentCategory", () => {
  it.each([
    ["image/png", "image"],
    ["video/mp4", "video"],
    ["audio/mpeg", "audio"],
    ["text/plain; charset=utf-8", "text"],
    ["application/pdf", "pdf"],
    ["application/zip", "archive"],
    ["APPLICATION/X-TAR", "archive"],
    ["application/octet-stream", "other"],
    ["", "other"],
  ])("%s → %s", (mimeType, category) => {
    expect(contentCategory(mimeType)).toBe(category);
  });
});

describe("files.uploaded", () => {
  it("takes a category and a size, nothing else", () => {
    const schema = fileUploadedEvent.properties;
    expect(
      schema.safeParse({ content_category: "pdf", size_bytes: 1024 }).success
    ).toBe(true);
    expect(
      schema.safeParse({
        content_category: "pdf",
        size_bytes: 1024,
        filename: "salaries.pdf",
      }).success
    ).toBe(false);
    expect(
      schema.safeParse({ content_category: "pdf", size_bytes: -1 }).success
    ).toBe(false);
  });
});
