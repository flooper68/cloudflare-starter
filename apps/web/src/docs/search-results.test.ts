import { describe, expect, it } from "vitest";

import { safeExcerpt, sectionLabel, toResult } from "./search-results";

describe("safeExcerpt", () => {
  it("keeps the <mark> highlights", () => {
    expect(safeExcerpt("choose the <mark>workspace</mark> mode")).toBe(
      "choose the <mark>workspace</mark> mode"
    );
  });

  it("drops any other tag", () => {
    expect(
      safeExcerpt('<img src=x onerror="alert(1)">a <b>bold</b> <markup>x')
    ).toBe("a bold x");
  });

  it("leaves escaped text escaped", () => {
    expect(safeExcerpt("&lt;script&gt; tags")).toBe("&lt;script&gt; tags");
  });
});

describe("toResult", () => {
  it("takes the title and section from the page's meta", () => {
    expect(
      toResult({
        url: "/docs/guides/how-to-configure-workspaces/",
        excerpt: "<mark>Workspace</mark> mode",
        meta: { title: " How to configure workspaces ", section: "Guides" },
      })
    ).toEqual({
      url: "/docs/guides/how-to-configure-workspaces/",
      title: "How to configure workspaces",
      excerpt: "<mark>Workspace</mark> mode",
      section: "Guides",
    });
  });

  it("falls back to the URL and the Docs label", () => {
    const result = toResult({ url: "/docs/start/", excerpt: "", meta: {} });
    expect(result.title).toBe("/docs/start/");
    expect(sectionLabel(result)).toBe("Docs");
  });
});
