import { describe, expect, it } from "vitest";

import {
  addMember,
  seedUser,
  seedWorkspace,
  useCaseDeps,
} from "../../test/fixtures";
import { addNoteComment } from "./add-note-comment";
import { createNote } from "./create-note";
import { getNote } from "./get-note";
import { trashNote } from "./trash-note";

describe("getNote", () => {
  it("returns the note with its body and comments, oldest first", async () => {
    const ada = await seedUser("Ada Get");
    const grace = await seedUser("Grace Get");
    const owner = await seedWorkspace(ada.id, { id: "ws-notes-get" });
    const member = await addMember(owner.workspaceId, grace.id);
    const note = await createNote(useCaseDeps(), owner, {
      title: "Q3 launch checklist",
      body: "Freeze the pricing page\nRun the restore drill",
    });
    const first = await addNoteComment(
      useCaseDeps("2026-11-01T10:00:00.000Z"),
      member,
      { noteId: note.id, body: "The drill is booked for Thursday." }
    );
    const second = await addNoteComment(
      useCaseDeps("2026-11-01T11:00:00.000Z"),
      owner,
      { noteId: note.id, body: "Thanks!" }
    );

    const detail = await getNote(useCaseDeps(), member, { noteId: note.id });
    expect(detail).toMatchObject({
      id: note.id,
      title: "Q3 launch checklist",
      body: "Freeze the pricing page\nRun the restore drill",
      excerpt: "Freeze the pricing page",
      commentCount: 2,
    });
    expect(detail.comments).toEqual([
      {
        id: first.id,
        body: "The drill is booked for Thursday.",
        author: { userId: grace.id, name: "Grace Get" },
        createdAt: "2026-11-01T10:00:00.000Z",
      },
      {
        id: second.id,
        body: "Thanks!",
        author: { userId: ada.id, name: "Ada Get" },
        createdAt: "2026-11-01T11:00:00.000Z",
      },
    ]);
  });

  it("is not found in another workspace or once in the trash", async () => {
    const ada = await seedUser("Ada Hidden");
    const eve = await seedUser("Eve Outsider");
    const actor = await seedWorkspace(ada.id, { id: "ws-notes-hidden" });
    const outsider = await seedWorkspace(eve.id, { id: "ws-notes-outsider" });
    const note = await createNote(useCaseDeps(), actor, { title: "Private" });

    await expect(
      getNote(useCaseDeps(), outsider, { noteId: note.id })
    ).rejects.toMatchObject({ kind: "not_found" });
    await trashNote(useCaseDeps(), actor, { noteId: note.id });
    await expect(
      getNote(useCaseDeps(), actor, { noteId: note.id })
    ).rejects.toMatchObject({ kind: "not_found" });
  });
});
