import { describe, expect, it } from "vitest";

import { withNoTransform } from "./cache-control";

describe("withNoTransform", () => {
  it("is no-transform alone when there is no Cache-Control", () => {
    expect(withNoTransform(null)).toBe("no-transform");
    expect(withNoTransform("")).toBe("no-transform");
  });

  it("keeps every directive and adds no public to a private or uncached response", () => {
    expect(withNoTransform("no-store")).toBe("no-store, no-transform");
    expect(withNoTransform("private, no-store")).toBe(
      "private, no-store, no-transform"
    );
    expect(withNoTransform("public, max-age=0, must-revalidate")).toBe(
      "public, max-age=0, must-revalidate, no-transform"
    );
  });

  it("adds it once", () => {
    expect(withNoTransform("public, No-Transform")).toBe(
      "public, No-Transform"
    );
    expect(withNoTransform(withNoTransform("no-store"))).toBe(
      "no-store, no-transform"
    );
  });

  it("normalises the spacing of the directives it keeps", () => {
    expect(withNoTransform(" no-store ,max-age=0,")).toBe(
      "no-store, max-age=0, no-transform"
    );
  });
});
