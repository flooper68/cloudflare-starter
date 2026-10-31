import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  addMember,
  auditTrail,
  rows,
  seedUser,
  seedWorkspace,
  storeTestFile,
  trashTestFile,
  useCaseDeps,
} from "../../test/fixtures";
import { TRASH_CATALOG } from "../trash-catalog";
import { ActionNotAllowedError } from "../workspaces";
import { emptyTrash } from "./empty-trash";

const deps = () => ({
  ...useCaseDeps(),
  bucket: env.FILES,
  entities: TRASH_CATALOG,
});

describe("emptyTrash", () => {
  it("deletes everything in this workspace's trash, nothing live and nothing elsewhere", async () => {
    const owner = await seedUser("Ada Lovelace");
    const outsider = await seedUser("Ken Thompson");
    const actor = await seedWorkspace(owner.id, { id: "ws-empty" });
    const other = await seedWorkspace(outsider.id, { id: "ws-empty-other" });
    const a = await storeTestFile(actor, "a.txt");
    const b = await storeTestFile(actor, "b.txt");
    const live = await storeTestFile(actor, "live.txt");
    const theirs = await storeTestFile(other, "theirs.txt");
    await trashTestFile(actor, a.fileId);
    await trashTestFile(actor, b.fileId);
    await trashTestFile(other, theirs.fileId);

    expect(await emptyTrash(deps(), actor)).toEqual({
      purged: 2,
      remaining: false,
    });
    expect(await env.FILES.head(a.r2Key)).toBeNull();
    expect(await env.FILES.head(b.r2Key)).toBeNull();
    expect(await env.FILES.head(live.r2Key)).not.toBeNull();
    expect(await env.FILES.head(theirs.r2Key)).not.toBeNull();
    expect(
      await rows("SELECT id FROM files WHERE workspace_id = ?", "ws-empty")
    ).toEqual([{ id: live.fileId }]);
    const purges = (await auditTrail("ws-empty")).filter(
      (event) => event.action === "trash.item_purged"
    );
    expect(purges.map((event) => event.metadata)).toEqual([
      { entityType: "file", reason: "empty_trash" },
      { entityType: "file", reason: "empty_trash" },
    ]);
    // Nothing left: a second run is a no-op.
    expect(await emptyTrash(deps(), actor)).toEqual({
      purged: 0,
      remaining: false,
    });
  });

  it("deletes at most 1000 items per call and says when more is left", async () => {
    const owner = await seedUser("Barbara Liskov");
    const actor = await seedWorkspace(owner.id, { id: "ws-empty-big" });
    const insert = env.DB.prepare(
      "INSERT INTO files (id, workspace_id, bucket, r2_key, filename, content_type, size_bytes, deleted_at, deleted_by) VALUES (?, 'ws-empty-big', 'files', ?, ?, 'text/plain', 1, ?, NULL)"
    );
    await env.DB.batch(
      Array.from({ length: 1001 }, (_, index) =>
        insert.bind(
          `big-${String(index).padStart(4, "0")}`,
          `workspaces/ws-empty-big/uploads/2026/10/big-${index}`,
          `scan-${index}.txt`,
          Date.parse("2026-10-01T00:00:00.000Z") + index
        )
      )
    );
    expect(await emptyTrash(deps(), actor)).toEqual({
      purged: 1000,
      remaining: true,
    });
    expect(await emptyTrash(deps(), actor)).toEqual({
      purged: 1,
      remaining: false,
    });
  });

  it("is for owners only", async () => {
    const owner = await seedUser("Grace Hopper");
    const colleague = await seedUser("Alan Turing");
    await seedWorkspace(owner.id, { id: "ws-empty-member" });
    const member = await addMember("ws-empty-member", colleague.id);
    await expect(emptyTrash(deps(), member)).rejects.toThrow(
      ActionNotAllowedError
    );
  });
});
