import { describe, expect, it } from "vitest";

import {
  errorTypeOf,
  httpMethodAttribute,
  secondsSince,
} from "./instrumentation";

describe("instrumentation helpers", () => {
  it("keeps known HTTP methods and maps anything else to _OTHER", () => {
    expect(httpMethodAttribute("GET")).toBe("GET");
    expect(httpMethodAttribute("PATCH")).toBe("PATCH");
    expect(httpMethodAttribute("get")).toBe("_OTHER");
    expect(httpMethodAttribute("PROPFIND")).toBe("_OTHER");
  });

  it("measures seconds from the clock, never negative", () => {
    const start = new Date("2026-10-28T12:00:00.000Z");
    expect(
      secondsSince({ now: () => new Date("2026-10-28T12:00:01.250Z") }, start)
    ).toBe(1.25);
    expect(
      secondsSince({ now: () => new Date("2026-10-28T11:59:59.000Z") }, start)
    ).toBe(0);
  });

  it("names the error type by class, never by message", () => {
    expect(errorTypeOf(new RangeError("user 42 not found"))).toBe("RangeError");
    expect(errorTypeOf("boom")).toBe("_OTHER");
    expect(errorTypeOf(null)).toBe("_OTHER");
  });
});
