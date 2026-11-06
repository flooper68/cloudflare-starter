import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { probeBucket } from "./probe-bucket";

describe("probeBucket", () => {
  it("answers against the real R2 and writes nothing", async () => {
    await expect(probeBucket({ bucket: env.FILES })).resolves.toBeUndefined();
    expect((await env.FILES.list()).objects).toEqual([]);
  });

  it("throws when R2 does not answer", async () => {
    const broken = {
      head: async () => {
        throw new Error("R2 unavailable");
      },
    } as unknown as R2Bucket;
    await expect(probeBucket({ bucket: broken })).rejects.toThrow(
      "R2 unavailable"
    );
  });
});
