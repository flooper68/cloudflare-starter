import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  addMember,
  seedUser,
  seedWorkspace,
  storeTestFile,
  testDb,
  trashTestFile,
} from "../../test/fixtures";
import { TRASH_CATALOG } from "../trash-catalog";
import { ActionNotAllowedError } from "../workspaces";
import { InvalidTrashInputError } from "./domain";
import { listTrash } from "./list-trash";

const deps = () => ({ db: testDb(), entities: TRASH_CATALOG });

describe("listTrash", () => {
  it("lists the workspace's trashed items, newest first, with who deleted them and when they go", async () => {
    const owner = await seedUser("Ada Lovelace");
    const colleague = await seedUser("Grace Hopper");
    const actor = await seedWorkspace(owner.id, { id: "ws-list-trash" });
    const member = await addMember("ws-list-trash", colleague.id);
    const live = await storeTestFile(actor, "live.txt");
    const older = await storeTestFile(actor, "older.txt", "first draft");
    const newer = await storeTestFile(actor, "newer.txt");
    await trashTestFile(actor, older.fileId, "2026-10-01T09:00:00.000Z");
    await trashTestFile(member, newer.fileId, "2026-10-20T09:00:00.000Z");

    const page = await listTrash(deps(), actor, {});
    expect(page).toEqual({
      items: [
        {
          type: "file",
          id: newer.fileId,
          label: "newer.txt",
          sizeBytes: 10,
          deletedAt: "2026-10-20T09:00:00.000Z",
          deletedBy: { userId: colleague.id, name: "Grace Hopper" },
          purgeAt: "2026-11-19T09:00:00.000Z",
        },
        {
          type: "file",
          id: older.fileId,
          label: "older.txt",
          sizeBytes: 11,
          deletedAt: "2026-10-01T09:00:00.000Z",
          deletedBy: { userId: owner.id, name: "Ada Lovelace" },
          purgeAt: "2026-10-31T09:00:00.000Z",
        },
      ],
      nextCursor: null,
      can: { restore: true, purge: true },
    });
    expect(page.items.map((item) => item.id)).not.toContain(live.fileId);

    // Members see the same trash; only owners may delete permanently.
    const asMember = await listTrash(deps(), member, { type: "file" });
    expect(asMember.items).toHaveLength(2);
    expect(asMember.can).toEqual({ restore: true, purge: false });
  });

  it("pages through items trashed in the same millisecond without skipping or repeating", async () => {
    const owner = await seedUser("Alan Turing");
    const actor = await seedWorkspace(owner.id, { id: "ws-list-pages" });
    const stored = [];
    for (let index = 0; index < 5; index += 1) {
      stored.push(await storeTestFile(actor, `scan-${index}.txt`));
    }
    for (const [index, file] of stored.entries()) {
      // Two pairs share a millisecond.
      const at = ["01", "01", "02", "02", "03"][index];
      await trashTestFile(actor, file.fileId, `2026-10-${at}T00:00:00.000Z`);
    }

    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await listTrash(deps(), actor, { limit: 2, cursor });
      seen.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor ?? undefined;
      pages += 1;
    } while (cursor);
    expect(pages).toBe(3);
    expect(new Set(seen).size).toBe(5);
    expect(seen.sort()).toEqual(stored.map((file) => file.fileId).sort());
  });

  it("shows another workspace's trash to nobody, and refuses unknown types and roles", async () => {
    const owner = await seedUser("Katherine Johnson");
    const outsider = await seedUser("Ken Thompson");
    const actor = await seedWorkspace(owner.id, { id: "ws-list-isolated" });
    const other = await seedWorkspace(outsider.id, { id: "ws-list-other" });
    const file = await storeTestFile(actor);
    await trashTestFile(actor, file.fileId);

    expect((await listTrash(deps(), other, {})).items).toEqual([]);
    await expect(listTrash(deps(), actor, { type: "note" })).rejects.toThrow(
      InvalidTrashInputError
    );
    await expect(
      listTrash(deps(), actor, { cursor: "not-a-cursor" })
    ).rejects.toThrow(InvalidTrashInputError);
    await expect(
      listTrash(
        deps(),
        { ...actor, role: "viewer" as unknown as typeof actor.role },
        {}
      )
    ).rejects.toThrow(ActionNotAllowedError);
  });

  it("shows no deleter once their account is gone", async () => {
    const owner = await seedUser("Margaret Hamilton");
    const leaver = await seedUser("Edsger Dijkstra");
    const actor = await seedWorkspace(owner.id, { id: "ws-list-leaver" });
    const member = await addMember("ws-list-leaver", leaver.id);
    const file = await storeTestFile(actor);
    await trashTestFile(member, file.fileId);
    // ON DELETE SET NULL clears deleted_by.
    await env.DB.prepare("DELETE FROM user WHERE id = ?").bind(leaver.id).run();
    const [item] = (await listTrash(deps(), actor, {})).items;
    expect(item?.deletedBy).toBeNull();
  });
});
