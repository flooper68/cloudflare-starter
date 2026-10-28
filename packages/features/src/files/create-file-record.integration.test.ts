import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  fixedClock,
  seedUser,
  sequentialIds,
  testDb,
} from "../../test/fixtures";
import { createFileRecord } from "./create-file-record";

describe("createFileRecord", () => {
  it("stores the record with a key derived from the id and the upload month", async () => {
    const owner = await seedUser();
    const file = await createFileRecord(
      { db: testDb(), clock: fixedClock(), ids: sequentialIds() },
      {
        filename: "roadmap.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
        ownerUserId: owner.id,
      }
    );

    expect(file).toEqual({
      fileId: "00000000-0000-4000-8000-000000000001",
      bucket: "files",
      r2Key: "uploads/2026/10/00000000-0000-4000-8000-000000000001",
    });
    const row = await env.DB.prepare(
      "SELECT filename, owner_user_id FROM files WHERE id = ?"
    )
      .bind(file.fileId)
      .first();
    expect(row).toEqual({ filename: "roadmap.pdf", owner_user_id: owner.id });
  });

  it("rejects an invalid filename without writing anything", async () => {
    const owner = await seedUser("Ada Lovelace");
    await expect(
      createFileRecord(
        { db: testDb(), clock: fixedClock(), ids: sequentialIds() },
        {
          filename: "../etc/passwd",
          mimeType: "text/plain",
          sizeBytes: 1,
          ownerUserId: owner.id,
        }
      )
    ).rejects.toThrow();
    const count = await env.DB.prepare(
      "SELECT count(*) AS n FROM files WHERE owner_user_id = ?"
    )
      .bind(owner.id)
      .first<{ n: number }>();
    expect(count?.n).toBe(0);
  });
});
