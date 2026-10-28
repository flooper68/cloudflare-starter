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
import { TrashItemNotFoundError } from "./domain";
import { purgeItems } from "./purge-items";

const deps = () => ({
  ...useCaseDeps(),
  bucket: env.FILES,
  entities: TRASH_CATALOG,
});

describe("purgeItems", () => {
  it("deletes the R2 object and the row of each item, and records each purge", async () => {
    const owner = await seedUser("Ada Lovelace");
    const actor = await seedWorkspace(owner.id, { id: "ws-purge" });
    const file = await storeTestFile(actor, "roadmap.txt");
    const kept = await storeTestFile(actor, "kept.txt");
    await trashTestFile(actor, file.fileId);
    await trashTestFile(actor, kept.fileId);

    expect(
      await purgeItems(deps(), actor, {
        items: [{ type: "file", id: file.fileId }],
      })
    ).toEqual({ purged: [{ type: "file", id: file.fileId }] });
    expect(await env.FILES.head(file.r2Key)).toBeNull();
    expect(await env.FILES.head(kept.r2Key)).not.toBeNull();
    expect(
      await rows("SELECT id FROM files WHERE workspace_id = ?", "ws-purge")
    ).toEqual([{ id: kept.fileId }]);
    expect((await auditTrail("ws-purge")).at(-1)).toEqual({
      action: "trash.item_purged",
      actor: owner.id,
      target: `file:${file.fileId}`,
      metadata: { entityType: "file", reason: "manual" },
    });

    // Already gone: not in the trash any more.
    await expect(
      purgeItems(deps(), actor, { items: [{ type: "file", id: file.fileId }] })
    ).rejects.toThrow(TrashItemNotFoundError);
  });

  it("is for owners only, and never touches live files or another workspace's trash", async () => {
    const owner = await seedUser("Grace Hopper");
    const colleague = await seedUser("Alan Turing");
    const outsider = await seedUser("Ken Thompson");
    const actor = await seedWorkspace(owner.id, { id: "ws-purge-guard" });
    const member = await addMember("ws-purge-guard", colleague.id);
    const other = await seedWorkspace(outsider.id, { id: "ws-purge-other" });
    const trashed = await storeTestFile(actor, "trashed.txt");
    const live = await storeTestFile(actor, "live.txt");
    await trashTestFile(actor, trashed.fileId);

    await expect(
      purgeItems(deps(), member, {
        items: [{ type: "file", id: trashed.fileId }],
      })
    ).rejects.toThrow(ActionNotAllowedError);
    for (const [who, id] of [
      [actor, live.fileId],
      [other, trashed.fileId],
    ] as const) {
      await expect(
        purgeItems(deps(), who, { items: [{ type: "file", id }] })
      ).rejects.toThrow(TrashItemNotFoundError);
    }
    expect(await env.FILES.head(trashed.r2Key)).not.toBeNull();
    expect(await env.FILES.head(live.r2Key)).not.toBeNull();
  });
});
