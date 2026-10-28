import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  fixedClock,
  seedUser,
  sequentialIds,
  testDb,
} from "../../test/fixtures";
import { createPresignedUpload } from "./create-presigned-upload";
import { PresignedUrlsUnavailableError } from "./domain";

const r2 = {
  accountId: "test-account",
  accessKeyId: "test-key-id",
  secretAccessKey: "test-secret",
  filesBucketName: "test-bucket",
};
const input = { filename: "video.mp4", mimeType: "video/mp4", sizeBytes: 4096 };

describe("createPresignedUpload", () => {
  it("records the file and returns a signed PUT URL for its key", async () => {
    const owner = await seedUser();
    const result = await createPresignedUpload(
      { db: testDb(), clock: fixedClock(), ids: sequentialIds(), r2 },
      { ...input, ownerUserId: owner.id }
    );

    const url = new URL(result.uploadUrl);
    expect(url.host).toBe("test-account.r2.cloudflarestorage.com");
    expect(url.pathname).toBe(`/test-bucket/${result.r2Key}`);
    expect(url.searchParams.get("X-Amz-Signature")).toBeTruthy();
    const row = await env.DB.prepare("SELECT id FROM files WHERE id = ?")
      .bind(result.fileId)
      .first();
    expect(row).toEqual({ id: result.fileId });
  });

  it("fails without R2 credentials and records nothing", async () => {
    const owner = await seedUser("Ada Lovelace");
    await expect(
      createPresignedUpload(
        { db: testDb(), clock: fixedClock(), ids: sequentialIds(), r2: null },
        { ...input, ownerUserId: owner.id }
      )
    ).rejects.toBeInstanceOf(PresignedUrlsUnavailableError);
    const count = await env.DB.prepare(
      "SELECT count(*) AS n FROM files WHERE owner_user_id = ?"
    )
      .bind(owner.id)
      .first<{ n: number }>();
    expect(count?.n).toBe(0);
  });
});
