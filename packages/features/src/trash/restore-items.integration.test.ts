import { describe, expect, it, vi } from "vitest";

import {
  addMember,
  auditTrail,
  seedUser,
  seedWorkspace,
  storeTestFile,
  testDb,
  trashTestFile,
  useCaseDeps,
} from "../../test/fixtures";
import { listWorkspaceFiles } from "../files";
import { DomainError } from "../kernel";
import { TRASH_CATALOG } from "../trash-catalog";
import { ActionNotAllowedError } from "../workspaces";
import type { TrashableEntity } from "./define-trashable-entity";
import { InvalidTrashInputError, TrashItemNotFoundError } from "./domain";
import { restoreItems } from "./restore-items";

const deps = (entities: readonly TrashableEntity[] = TRASH_CATALOG) => ({
  ...useCaseDeps(),
  entities,
});

describe("restoreItems", () => {
  it("brings files back to the file list and records each restore", async () => {
    const owner = await seedUser("Ada Lovelace");
    const colleague = await seedUser("Grace Hopper");
    const actor = await seedWorkspace(owner.id, { id: "ws-restore" });
    const member = await addMember("ws-restore", colleague.id);
    const a = await storeTestFile(actor, "a.txt");
    const b = await storeTestFile(actor, "b.txt");
    await trashTestFile(actor, a.fileId);
    await trashTestFile(actor, b.fileId);

    expect(
      await restoreItems(deps(), member, {
        items: [
          { type: "file", id: a.fileId },
          { type: "file", id: b.fileId },
        ],
      })
    ).toEqual({
      restored: [
        { type: "file", id: a.fileId },
        { type: "file", id: b.fileId },
      ],
    });
    const listed = await listWorkspaceFiles({ db: testDb() }, actor, {});
    expect(listed.map((file) => file.id).sort()).toEqual(
      [a.fileId, b.fileId].sort()
    );
    const trail = await auditTrail("ws-restore");
    expect(
      trail.filter((event) => event.action === "trash.item_restored")
    ).toEqual([
      {
        action: "trash.item_restored",
        actor: colleague.id,
        target: `file:${a.fileId}`,
        metadata: { entityType: "file" },
      },
      {
        action: "trash.item_restored",
        actor: colleague.id,
        target: `file:${b.fileId}`,
        metadata: { entityType: "file" },
      },
    ]);
  });

  it("restores nothing unless every item is in this trash", async () => {
    const owner = await seedUser("Alan Turing");
    const outsider = await seedUser("Ken Thompson");
    const actor = await seedWorkspace(owner.id, { id: "ws-restore-all" });
    const other = await seedWorkspace(outsider.id, { id: "ws-restore-else" });
    const trashed = await storeTestFile(actor, "trashed.txt");
    const live = await storeTestFile(actor, "live.txt");
    const elsewhere = await storeTestFile(other, "elsewhere.txt");
    await trashTestFile(actor, trashed.fileId);
    await trashTestFile(other, elsewhere.fileId);

    for (const id of [live.fileId, elsewhere.fileId, "missing"]) {
      await expect(
        restoreItems(deps(), actor, {
          items: [
            { type: "file", id: trashed.fileId },
            { type: "file", id },
          ],
        })
      ).rejects.toThrow(TrashItemNotFoundError);
    }
    await expect(
      restoreItems(deps(), actor, { items: [{ type: "note", id: "x" }] })
    ).rejects.toThrow(InvalidTrashInputError);
    const listed = await listWorkspaceFiles({ db: testDb() }, actor, {});
    expect(listed.map((file) => file.id)).toEqual([live.fileId]);
    // The other workspace's file stays in its trash.
    expect(await listWorkspaceFiles({ db: testDb() }, other, {})).toEqual([]);
  });

  it("needs trash.restore and the entity's write permission, and runs its restore check", async () => {
    const owner = await seedUser("Barbara Liskov");
    const actor = await seedWorkspace(owner.id, { id: "ws-restore-check" });
    const file = await storeTestFile(actor);
    await trashTestFile(actor, file.fileId);
    const items = [{ type: "file", id: file.fileId }];

    await expect(
      restoreItems(
        deps(),
        { ...actor, role: "viewer" as unknown as typeof actor.role },
        { items }
      )
    ).rejects.toThrow(ActionNotAllowedError);

    const fileTrash = TRASH_CATALOG[0] as TrashableEntity;
    class SeatsFull extends DomainError {
      constructor() {
        super("limit_reached", "No room to restore");
      }
    }
    const checkRestore = vi.fn(async () => {
      throw new SeatsFull();
    });
    await expect(
      restoreItems(deps([{ ...fileTrash, checkRestore }]), actor, { items })
    ).rejects.toThrow(SeatsFull);
    expect(checkRestore).toHaveBeenCalledWith(expect.anything(), actor, [
      expect.objectContaining({ id: file.fileId }),
    ]);
    expect(await listWorkspaceFiles({ db: testDb() }, actor, {})).toEqual([]);

    await expect(
      restoreItems(
        deps([{ ...fileTrash, permission: "billing.manage" }]),
        {
          ...actor,
          role: "member",
        },
        { items }
      )
    ).rejects.toThrow(ActionNotAllowedError);
  });
});
