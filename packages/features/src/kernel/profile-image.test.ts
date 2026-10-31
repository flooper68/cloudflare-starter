import { describe, expect, it } from "vitest";
import { profileImageType } from "./profile-image";

describe("profileImageType", () => {
  it("sniffs each allowed raster format", () => {
    expect(
      profileImageType(
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        "image/png"
      )
    ).toBe("image/png");
    expect(
      profileImageType(new Uint8Array([255, 216, 255, 224]), "image/jpeg")
    ).toBe("image/jpeg");
    expect(
      profileImageType(
        new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]),
        "image/webp"
      )
    ).toBe("image/webp");
  });
  it("rejects SVG, MIME mismatch, empty and oversized input", () => {
    expect(() =>
      profileImageType(new TextEncoder().encode("<svg/>"), "image/svg+xml")
    ).toThrow();
    expect(() =>
      profileImageType(new Uint8Array([255, 216, 255]), "image/png")
    ).toThrow();
    expect(() => profileImageType(new Uint8Array(), "image/png")).toThrow();
    expect(() =>
      profileImageType(new Uint8Array(1024 * 1024 + 1), "image/png")
    ).toThrow();
  });
});
