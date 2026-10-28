import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  fixedClock,
  seedUser,
  seedWorkspace,
  sequentialIds,
  testBilling,
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
    const actor = await seedWorkspace(owner.id);
    const result = await createPresignedUpload(
      {
        db: testDb(),
        clock: fixedClock(),
        ids: sequentialIds(),
        billing: testBilling(),
        r2,
      },
      actor,
      input
    );

    const url = new URL(result.uploadUrl);
    expect(url.host).toBe("test-account.r2.cloudflarestorage.com");
    expect(url.pathname).toBe(`/test-bucket/${result.r2Key}`);
    expect(url.searchParams.get("X-Amz-Signature")).toBeTruthy();
    const row = await env.DB.prepare(
      "SELECT workspace_id FROM files WHERE id = ?"
    )
      .bind(result.fileId)
      .first();
    expect(row).toEqual({ workspace_id: actor.workspaceId });
  });

  it("fails without R2 credentials and records nothing", async () => {
    const owner = await seedUser("Ada Lovelace");
    const actor = await seedWorkspace(owner.id);
    await expect(
      createPresignedUpload(
        {
          db: testDb(),
          clock: fixedClock(),
          ids: sequentialIds(),
          billing: testBilling(),
          r2: null,
        },
        actor,
        input
      )
    ).rejects.toBeInstanceOf(PresignedUrlsUnavailableError);
    const count = await env.DB.prepare(
      "SELECT count(*) AS n FROM files WHERE workspace_id = ?"
    )
      .bind(actor.workspaceId)
      .first<{ n: number }>();
    expect(count?.n).toBe(0);
  });

  it("is a gated feature: refused on a plan without files.presigned_upload, before anything is written", async () => {
    const owner = await seedUser("Grace Hopper");
    const actor = await seedWorkspace(owner.id, { id: "ws-free-plan" });
    // Manual billing, no subscription: the free plan, which lacks direct uploads.
    await expect(
      createPresignedUpload(
        {
          db: testDb(),
          clock: fixedClock(),
          ids: sequentialIds(),
          billing: testBilling("manual"),
          r2,
        },
        actor,
        input
      )
    ).rejects.toMatchObject({
      kind: "limit_reached",
      code: "FEATURE_NOT_INCLUDED",
      details: { feature: "files.presigned_upload", planId: "free" },
    });
    const count = await env.DB.prepare(
      "SELECT count(*) AS n FROM files WHERE workspace_id = ?"
    )
      .bind(actor.workspaceId)
      .first<{ n: number }>();
    expect(count?.n).toBe(0);
  });
});
