import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  billingDeps,
  fixedClock,
  rows,
  seedUser,
  seedWorkspace,
  sequentialIds,
  testBilling,
  testDb,
} from "../../test/fixtures";
import { LimitReachedError, setOverride } from "../billing";
import { createFileRecord } from "./create-file-record";

describe("createFileRecord", () => {
  it("stores the record in the actor's workspace with a key under the workspace", async () => {
    const owner = await seedUser();
    const actor = await seedWorkspace(owner.id, { id: "ws-acme" });
    const file = await createFileRecord(
      {
        db: testDb(),
        clock: fixedClock(),
        ids: sequentialIds(),
        billing: testBilling(),
      },
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
        {
          db: testDb(),
          clock: fixedClock(),
          ids: sequentialIds(),
          billing: testBilling(),
        },
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

describe("createFileRecord limits (billing)", () => {
  it("refuses a file past the storage_bytes limit and counts files.uploads_per_month", async () => {
    const owner = await seedUser("Grace Hopper");
    const admin = await seedUser("Alan Admin");
    const actor = await seedWorkspace(owner.id, { id: "ws-limits" });
    const deps = {
      db: testDb(),
      clock: fixedClock(),
      ids: sequentialIds("cccccccc-0000-4000-8000-"),
      billing: testBilling("manual"),
    };
    await setOverride(
      billingDeps(),
      { userId: admin.id },
      {
        workspaceId: actor.workspaceId,
        key: "storage_bytes",
        override: { kind: "limit", limit: 5000 },
        reason: "Tiny quota for the test",
      }
    );
    const file = (sizeBytes: number) => ({
      filename: "scan.png",
      mimeType: "image/png",
      sizeBytes,
    });

    await createFileRecord(deps, actor, file(3000));
    // 3000 + 2000 is exactly the limit; one more byte is not.
    await expect(
      createFileRecord(deps, actor, file(2001))
    ).rejects.toMatchObject({
      kind: "limit_reached",
      details: {
        metric: "storage_bytes",
        limit: 5000,
        current: 3000,
        increment: 2001,
      },
    });
    await createFileRecord(deps, actor, file(2000));
    expect(
      await rows(
        "SELECT value FROM usage_counter WHERE workspace_id = ? AND metric = ?",
        actor.workspaceId,
        "files.uploads_per_month"
      )
    ).toEqual([{ value: 2 }]);
  });

  it("refuses an upload past the files.uploads_per_month limit", async () => {
    const owner = await seedUser("Mary Jackson");
    const admin = await seedUser("Barbara Admin");
    const actor = await seedWorkspace(owner.id, { id: "ws-monthly" });
    await setOverride(
      billingDeps(),
      { userId: admin.id },
      {
        workspaceId: actor.workspaceId,
        key: "files.uploads_per_month",
        override: { kind: "limit", limit: 1 },
        reason: "One upload a month",
      }
    );
    const deps = {
      db: testDb(),
      clock: fixedClock(),
      ids: sequentialIds("dddddddd-0000-4000-8000-"),
      billing: testBilling("manual"),
    };
    const file = { filename: "a.txt", mimeType: "text/plain", sizeBytes: 1 };
    await createFileRecord(deps, actor, file);
    const refused = createFileRecord(deps, actor, file);
    await expect(refused).rejects.toBeInstanceOf(LimitReachedError);
    await expect(refused).rejects.toMatchObject({
      details: { metric: "files.uploads_per_month", limit: 1, current: 1 },
    });
  });
});
