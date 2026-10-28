import { describe, expect, it } from "vitest";

import { MAX_UPLOAD_BYTES, uploadInputSchema } from "./upload-input";

const valid = {
  filename: "roadmap.pdf",
  mimeType: "application/pdf",
  sizeBytes: 10,
};

describe("uploadInputSchema", () => {
  it("accepts a simple filename within the size limit", () => {
    expect(uploadInputSchema.parse(valid)).toEqual(valid);
  });

  it("rejects path-like filenames", () => {
    expect(() =>
      uploadInputSchema.parse({ ...valid, filename: "../bad.png" })
    ).toThrow();
  });

  it("rejects files over the limit", () => {
    expect(() =>
      uploadInputSchema.parse({ ...valid, sizeBytes: MAX_UPLOAD_BYTES + 1 })
    ).toThrow();
  });
});
