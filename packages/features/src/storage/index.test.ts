import { describe, expect, it } from "vitest";

import { buildFileKey, uploadInputSchema } from "./index";

describe("storage", () => {
  it("builds canonical keys", () => {
    expect(buildFileKey("abc", new Date("2026-04-19T00:00:00.000Z"))).toBe(
      "uploads/2026/04/abc"
    );
  });

  it("validates uploads", () => {
    expect(() =>
      uploadInputSchema.parse({
        filename: "../bad.png",
        mimeType: "image/png",
        sizeBytes: 10,
      })
    ).toThrow();
  });
});
