import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  fixedClock,
  seedUser,
  seedWorkspace,
  sequentialIds,
  testDb,
} from "../../test/fixtures";
import { createFileRecord } from "./create-file-record";

describe("createFileRecord", () => {
  it("stores the record in the actor's workspace with a key under the workspace", async () => {
    const owner = await seedUser();
    const actor = await seedWorkspace(owner.id, { id: "ws-acme" });
    const file = await createFileRecord(
      { db: testDb(), clock: fixedClock(), ids: sequentialIds() },
      actor,
      { filename: "roadmap.pdf", mimeType: "application/pdf", sizeBytes: 2048 }
    );

    expect(file).toEqual({
      fileId: "00000000-0000-4000-8000-000000000001",
      bucket: "files",
      r2Key:
        "workspaces/ws-acme/uploads/2026/10/00000000-0000-4000-8000-000000000001",
    });
    const row = await env.DB.prepare(
      "SELECT filename, workspace_id, created_by FROM files WHERE id = ?"
    )
      .bind(file.fileId)
      .first();
    expect(row).toEqual({
      filename: "roadmap.pdf",
      workspace_id: "ws-acme",
      created_by: owner.id,
    });
  });

  it("rejects an invalid filename without writing anything", async () => {
    const owner = await seedUser("Ada Lovelace");
    const actor = await seedWorkspace(owner.id, { id: "ws-ada" });
    await expect(
      createFileRecord(
        { db: testDb(), clock: fixedClock(), ids: sequentialIds() },
        actor,
        { filename: "../etc/passwd", mimeType: "text/plain", sizeBytes: 1 }
      )
    ).rejects.toThrow();
    const count = await env.DB.prepare(
      "SELECT count(*) AS n FROM files WHERE workspace_id = ?"
    )
      .bind("ws-ada")
      .first<{ n: number }>();
    expect(count?.n).toBe(0);
  });
});
