import { describe, expect, it } from "vitest";

import {
  addMember,
  fixedClock,
  seedUser,
  seedWorkspace,
  sequentialIds,
  testBilling,
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
  it("signs a GET URL for members of the file's workspace only", async () => {
    const owner = await seedUser();
    const colleague = await seedUser("Grace Hopper");
    const stranger = await seedUser("Alan Turing");
    const actor = await seedWorkspace(owner.id, { id: "ws-acme" });
    const member = await addMember("ws-acme", colleague.id);
    const elsewhere = await seedWorkspace(stranger.id, { id: "ws-other" });
    const file = await createFileRecord(
      {
        db: testDb(),
        clock: fixedClock(),
        ids: sequentialIds(),
        billing: testBilling(),
      },
      actor,
      { filename: "report.pdf", mimeType: "application/pdf", sizeBytes: 10 }
    );

    const { url } = await createDownloadUrl({ db: testDb(), r2 }, member, {
      fileId: file.fileId,
    });
    expect(new URL(url).pathname).toBe(`/test-bucket/${file.r2Key}`);
    await expect(
      createDownloadUrl({ db: testDb(), r2 }, elsewhere, {
        fileId: file.fileId,
      })
    ).rejects.toBeInstanceOf(FileNotFoundError);
  });

  it("fails without R2 credentials", async () => {
    await expect(
      createDownloadUrl(
        { db: testDb(), r2: null },
        { userId: "u", workspaceId: "w", role: "owner" },
        { fileId: "x" }
      )
    ).rejects.toBeInstanceOf(PresignedUrlsUnavailableError);
  });
});
