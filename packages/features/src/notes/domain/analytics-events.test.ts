import { describe, expect, it } from "vitest";

import { noteCreatedEvent, noteLengthBucket } from "./analytics-events";

describe("notes analytics", () => {
  it("buckets a body by length, never by its text", () => {
    expect(noteLengthBucket("")).toBe("empty");
    expect(noteLengthBucket("   ")).toBe("empty");
    expect(noteLengthBucket("Freeze the pricing page")).toBe("short");
    expect(noteLengthBucket("x".repeat(500))).toBe("long");
  });

  it("accepts only the length bucket as a property", () => {
    expect(
      noteCreatedEvent.properties.safeParse({ length: "short" }).success
    ).toBe(true);
    expect(
      noteCreatedEvent.properties.safeParse({ length: "short", title: "Q3" })
        .success
    ).toBe(false);
  });
});
