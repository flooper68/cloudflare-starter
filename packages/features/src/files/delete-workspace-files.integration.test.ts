import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import {
  fixedClock,
  seedUser,
  seedWorkspace,
  sequentialIds,
  testDb,
  testRequestContext,
} from "../../test/fixtures";
import { createMemoryProductAnalytics } from "../platform";
import { deleteWorkspaceFiles } from "./delete-workspace-files";
import { storeFile } from "./store-file";

describe("deleteWorkspaceFiles", () => {
  it("deletes the objects and rows of the given workspaces only", async () => {
    const owner = await seedUser();
    const doomed = await seedWorkspace(owner.id, { id: "ws-doomed" });
    const kept = await seedWorkspace(owner.id, { id: "ws-kept" });
    const deps = {
      db: testDb(),
      bucket: env.FILES,
      clock: fixedClock(),
      ids: sequentialIds("abababab-0000-4000-8000-"),
      requestContext: testRequestContext(),
      analytics: createMemoryProductAnalytics(),
    };
    const body = new TextEncoder().encode("x").buffer as ArrayBuffer;
    const input = {
      filename: "x.txt",
      mimeType: "text/plain",
      sizeBytes: 1,
      body,
    };
    const gone = await storeFile(deps, doomed, input);
    const stays = await storeFile(deps, kept, input);

    expect(
      await deleteWorkspaceFiles(
        { db: testDb(), bucket: env.FILES },
        { workspaceIds: ["ws-doomed"] }
      )
    ).toEqual({ deleted: 1 });
    expect(await env.FILES.head(gone.r2Key)).toBeNull();
    expect(await env.FILES.head(stays.r2Key)).not.toBeNull();
    const rows = await env.DB.prepare("SELECT workspace_id FROM files").all();
    expect(rows.results).toEqual([{ workspace_id: "ws-kept" }]);
  });

  it("does nothing for no workspaces", async () => {
    expect(
      await deleteWorkspaceFiles(
        { db: testDb(), bucket: env.FILES },
        { workspaceIds: [] }
      )
    ).toEqual({ deleted: 0 });
  });
});
