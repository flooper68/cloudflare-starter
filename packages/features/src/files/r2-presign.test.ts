import { describe, expect, it } from "vitest";

import { presignR2Url } from "./r2-presign";

const r2 = {
  accountId: "acct",
  accessKeyId: "key",
  secretAccessKey: "secret",
  filesBucketName: "bucket",
};

describe("presignR2Url", () => {
  it("signs a query-string URL for the object with the expiry", async () => {
    const url = new URL(
      await presignR2Url(r2, "uploads/2026/10/abc", { method: "GET" }, 600)
    );
    expect(url.origin).toBe("https://acct.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/bucket/uploads/2026/10/abc");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("includes content headers in a PUT signature", async () => {
    const url = new URL(
      await presignR2Url(r2, "k", {
        method: "PUT",
        headers: { "Content-Type": "text/plain", "Content-Length": "3" },
      })
    );
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain(
      "content-type"
    );
  });
});
