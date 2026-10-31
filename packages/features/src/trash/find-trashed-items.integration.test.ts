import { describe, expect, it } from "vitest";

import {
  seedUser,
  seedWorkspace,
  storeTestFile,
  testDb,
  trashTestFile,
} from "../../test/fixtures";
import { TRASH_CATALOG } from "../trash-catalog";
import { InvalidTrashInputError, TrashItemNotFoundError } from "./domain";
import { findTrashedItems } from "./find-trashed-items";

const deps = () => ({ db: testDb(), entities: TRASH_CATALOG });

describe("findTrashedItems", () => {
  it("loads the named items of this trash grouped by entity, all or nothing", async () => {
    const owner = await seedUser("Ada Lovelace");
    const actor = await seedWorkspace(owner.id, { id: "ws-find-trashed" });
    const a = await storeTestFile(actor, "a.txt");
    const b = await storeTestFile(actor, "b.txt");
    const live = await storeTestFile(actor, "live.txt");
    await trashTestFile(actor, a.fileId);
    await trashTestFile(actor, b.fileId);

    const groups = await findTrashedItems(deps(), actor, {
      items: [
        { type: "file", id: a.fileId },
        { type: "file", id: b.fileId },
      ],
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]?.entity.type).toBe("file");
    expect(groups[0]?.rows.map((row) => row.id).sort()).toEqual(
      [a.fileId, b.fileId].sort()
    );

    await expect(
      findTrashedItems(deps(), actor, {
        items: [
          { type: "file", id: a.fileId },
          { type: "file", id: live.fileId },
        ],
      })
    ).rejects.toThrow(
      new TrashItemNotFoundError({ type: "file", id: live.fileId })
    );
    await expect(
      findTrashedItems(deps(), actor, { items: [{ type: "note", id: "1" }] })
    ).rejects.toThrow(InvalidTrashInputError);
  });
});
