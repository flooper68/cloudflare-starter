import { describe, expect, it } from "vitest";

import {
  fixedClock,
  seedUser,
  sequentialIds,
  testDb,
} from "../../test/fixtures";
import { createDownloadUrl } from "./create-download-url";
import { createFileRecord } from "./create-file-record";
import { FileNotFoundError, PresignedUrlsUnavailableError } from "./domain";

const r2 = {
  accountId: "test-account",
  accessKeyId: "test-key-id",
  secretAccessKey: "test-secret",
  filesBucketName: "test-bucket",
};

describe("createDownloadUrl", () => {
  it("signs a GET URL for the owner's file only", async () => {
    const owner = await seedUser();
    const stranger = await seedUser("Alan Turing");
    const file = await createFileRecord(
      { db: testDb(), clock: fixedClock(), ids: sequentialIds() },
      {
        filename: "report.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10,
        ownerUserId: owner.id,
      }
    );

    const { url } = await createDownloadUrl(
      { db: testDb(), r2 },
      { fileId: file.fileId, ownerUserId: owner.id }
    );
    expect(new URL(url).pathname).toBe(`/test-bucket/${file.r2Key}`);
    await expect(
      createDownloadUrl(
        { db: testDb(), r2 },
        { fileId: file.fileId, ownerUserId: stranger.id }
      )
    ).rejects.toBeInstanceOf(FileNotFoundError);
  });

  it("fails without R2 credentials", async () => {
    await expect(
      createDownloadUrl(
        { db: testDb(), r2: null },
        { fileId: "x", ownerUserId: "y" }
      )
    ).rejects.toBeInstanceOf(PresignedUrlsUnavailableError);
  });
});
