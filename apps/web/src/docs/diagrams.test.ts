import { describe, expect, it } from "vitest";

import { diagramHtml, diagramPath } from "./diagrams";

const SVG = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" role="img">
  <title>Flow</title>
  <rect width="10" height="10"/>
</svg>
`;

describe("diagramPath", () => {
  it("resolves a relative .svg against the doc's folder", () => {
    expect(
      diagramPath("docs/processes/x.md", "images/agentic-lifecycle.svg")
    ).toBe("docs/processes/images/agentic-lifecycle.svg");
    expect(diagramPath("docs/processes/x.md", "../img/a.SVG")).toBe(
      "docs/img/a.SVG"
    );
  });

  it.each([
    "images/photo.png",
    "https://example.com/a.svg",
    "/docs/a.svg",
    "#a.svg",
    "images/",
    "../../../outside.svg",
  ])("leaves %s to Astro", (url) => {
    expect(diagramPath("docs/processes/x.md", url)).toBeNull();
  });
});

describe("diagramHtml", () => {
  it("inlines the SVG on one line in a named, focusable figure", () => {
    const html = diagramHtml("a.svg", SVG, 'The "flow" & more');
    expect(html).toBe(
      '<figure data-docs-diagram="" tabindex="0" aria-label="The &quot;flow&quot; &amp; more">' +
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" role="img"> <title>Flow</title> <rect width="10" height="10"/> </svg></figure>'
    );
    expect(html).not.toContain("\n");
  });

  it.each([
    ["<div>not svg</div>", "does not start with <svg>"],
    ['<svg role="img"><rect/></svg>', "has no <title>"],
    ["<svg><title>x</title><script>alert(1)</script></svg>", "contains script"],
    ['<svg><title>x</title><rect onclick="x()"/></svg>', "contains script"],
    [
      '<svg><title>x</title><a href="javascript:x()"/></svg>',
      "contains script",
    ],
  ])("refuses %s", (svg, problem) => {
    expect(() => diagramHtml("a.svg", svg, "alt")).toThrow(problem);
  });

  it("refuses an image without alt text", () => {
    expect(() => diagramHtml("a.svg", SVG, " ")).toThrow("without alt text");
  });
});
