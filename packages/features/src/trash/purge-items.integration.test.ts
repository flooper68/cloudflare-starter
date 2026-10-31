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
import type { TrashableEntity } from "./define-trashable-entity";
import { TrashItemNotFoundError } from "./domain";
import { purgeItems } from "./purge-items";
import { restoreItems } from "./restore-items";

const deps = () => ({
  ...useCaseDeps(),
  bucket: env.FILES,
  entities: TRASH_CATALOG,
});

describe("purgeItems", () => {
  it("spares a file restored while the purge runs: no deletion, no purge event", async () => {
    const owner = await seedUser("Edsger Dijkstra");
    const actor = await seedWorkspace(owner.id, { id: "ws-purge-race" });
    const file = await storeTestFile(actor, "race.txt");
    await trashTestFile(actor, file.fileId);
    const fileTrash = TRASH_CATALOG[0] as TrashableEntity;
    // A member restores the file between the purge's read and its delete.
    const racing: TrashableEntity = {
      ...fileTrash,
      async purge(purgeDeps, ids, options) {
        await restoreItems(
          { ...useCaseDeps(), entities: TRASH_CATALOG },
          actor,
          {
            items: [{ type: "file", id: file.fileId }],
          }
        );
        return fileTrash.purge(purgeDeps, ids, options);
      },
    };

    expect(
      await purgeItems({ ...deps(), entities: [racing] }, actor, {
        items: [{ type: "file", id: file.fileId }],
      })
    ).toEqual({ purged: [] });
    expect(await env.FILES.head(file.r2Key)).not.toBeNull();
    expect(
      await rows("SELECT deleted_at FROM files WHERE id = ?", file.fileId)
    ).toEqual([{ deleted_at: null }]);
    expect(
      (await auditTrail("ws-purge-race")).map((event) => event.action)
    ).toEqual(["trash.item_trashed", "trash.item_restored"]);
  });

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
