import { describe, expect, it } from "vitest";

import {
  addMember,
  auditTrail,
  seedUser,
  seedWorkspace,
  useCaseDeps,
} from "../../test/fixtures";
import { listTrash, restoreItems } from "../trash";
import { TRASH_CATALOG } from "../trash-catalog";
import { addNoteComment } from "./add-note-comment";
import { createNote } from "./create-note";
import { getNote } from "./get-note";
import { listNotes } from "./list-notes";
import { trashNote } from "./trash-note";

describe("trashNote", () => {
  it("moves a note and its comments to the trash; restoring brings both back", async () => {
    const ada = await seedUser("Ada Trash");
    const grace = await seedUser("Grace Trash");
    const owner = await seedWorkspace(ada.id, { id: "ws-notes-trash" });
    const member = await addMember(owner.workspaceId, grace.id);
    const note = await createNote(useCaseDeps(), owner, {
      title: "Support macros",
    });
    await addNoteComment(useCaseDeps(), owner, {
      noteId: note.id,
      body: "Add the refund macro",
    });

    expect(
      await trashNote(useCaseDeps("2026-11-01T00:00:00.000Z"), member, {
        noteId: note.id,
      })
    ).toEqual({
      type: "note",
      id: note.id,
      deletedAt: "2026-11-01T00:00:00.000Z",
      purgeAt: "2026-12-01T00:00:00.000Z",
    });
    expect((await listNotes(useCaseDeps(), owner, {})).items).toEqual([]);
    const trash = await listTrash(
      { ...useCaseDeps(), entities: TRASH_CATALOG },
      owner,
      {}
    );
    expect(trash.items).toEqual([
      expect.objectContaining({
        type: "note",
        id: note.id,
        label: "Support macros",
        sizeBytes: null,
        deletedBy: { userId: grace.id, name: "Grace Trash" },
      }),
    ]);
    expect((await auditTrail("ws-notes-trash")).at(-1)).toMatchObject({
      action: "trash.item_trashed",
      target: `note:${note.id}`,
      metadata: { entityType: "note" },
    });
    // Twice is not found: it is no longer live.
    await expect(
      trashNote(useCaseDeps(), member, { noteId: note.id })
    ).rejects.toMatchObject({ kind: "not_found" });

    await restoreItems({ ...useCaseDeps(), entities: TRASH_CATALOG }, member, {
      items: [{ type: "note", id: note.id }],
    });
    const restored = await getNote(useCaseDeps(), owner, { noteId: note.id });
    expect(restored.comments.map((comment) => comment.body)).toEqual([
      "Add the refund macro",
    ]);
  });
});
