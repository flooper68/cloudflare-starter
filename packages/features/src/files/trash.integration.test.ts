import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  rows,
  seedUser,
  seedWorkspace,
  storeTestFile,
  testDb,
  trashTestFile,
} from "../../test/fixtures";
import { measureWorkspaceStorage } from "./measure-workspace-storage";
import { fileTrash } from "./trash";

describe("fileTrash", () => {
  it("is the file entity: 30 days, restored with files.write, summarised by name and size", async () => {
    expect(fileTrash).toMatchObject({
      type: "file",
      retentionDays: 30,
      permission: "files.write",
    });
    const owner = await seedUser("Ada Lovelace");
    const actor = await seedWorkspace(owner.id, { id: "ws-file-entity" });
    const file = await storeTestFile(actor, "roadmap.txt", "Q4 roadmap");
    const [row] = await testDb().query.files.findMany({
      where: (files, { eq }) => eq(files.id, file.fileId),
    });
    if (!row) throw new Error("file row missing");
    expect(fileTrash.summarize(row)).toEqual({
      label: "roadmap.txt",
      sizeBytes: 10,
    });
    await expect(
      fileTrash.checkRestore(
        { db: testDb(), billing: undefined as never },
        actor,
        [row]
      )
    ).resolves.toBeUndefined();
  });

  it("purge deletes the objects first, then the rows; a rerun deletes nothing", async () => {
    const owner = await seedUser("Grace Hopper");
    const actor = await seedWorkspace(owner.id, { id: "ws-file-purge" });
    const gone = await storeTestFile(actor, "gone.txt");
    const live = await storeTestFile(actor, "live.txt");
    await trashTestFile(actor, gone.fileId);
    const deps = { db: testDb(), bucket: env.FILES };

    // GDPR erasure purges live files too: purge checks nothing, its caller chooses ids.
    expect(await fileTrash.purge(deps, [gone.fileId, live.fileId])).toEqual({
      purged: 2,
    });
    expect(await env.FILES.head(gone.r2Key)).toBeNull();
    expect(await env.FILES.head(live.r2Key)).toBeNull();
    expect(
      await rows(
        "SELECT id FROM files WHERE workspace_id = ?",
        actor.workspaceId
      )
    ).toEqual([]);
    expect(await fileTrash.purge(deps, [gone.fileId])).toEqual({ purged: 0 });
    expect(await fileTrash.purge(deps, [])).toEqual({ purged: 0 });
  });

  it("purges more ids than one statement binds", async () => {
    const owner = await seedUser("Alan Turing");
    const actor = await seedWorkspace(owner.id, { id: "ws-file-many" });
    const stored = await Promise.all(
      Array.from({ length: 120 }, (_, index) =>
        storeTestFile(actor, `scan-${index}.txt`, "x")
      )
    );
    expect(
      await fileTrash.purge(
        { db: testDb(), bucket: env.FILES },
        stored.map((file) => file.fileId)
      )
    ).toEqual({ purged: 120 });
    expect(
      (await env.FILES.list({ prefix: `workspaces/${actor.workspaceId}/` }))
        .objects
    ).toEqual([]);
  });

  it("trashed files count toward storage until they are purged", async () => {
    const owner = await seedUser("Katherine Johnson");
    const actor = await seedWorkspace(owner.id, { id: "ws-file-storage" });
    const file = await storeTestFile(actor, "orbit.txt", "trajectory");
    const measure = () =>
      measureWorkspaceStorage(
        { db: testDb() },
        { workspaceId: actor.workspaceId }
      );
    expect(await measure()).toBe(10);
    await trashTestFile(actor, file.fileId);
    expect(await measure()).toBe(10);
    await fileTrash.purge({ db: testDb(), bucket: env.FILES }, [file.fileId]);
    expect(await measure()).toBe(0);
  });
});
