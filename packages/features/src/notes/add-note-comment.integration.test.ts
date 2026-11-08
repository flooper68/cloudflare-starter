import { describe, expect, it } from "vitest";

import {
  addMember,
  auditTrail,
  rows,
  seedUser,
  seedWorkspace,
  useCaseDeps,
} from "../../test/fixtures";
import { addNoteComment } from "./add-note-comment";
import { createNote } from "./create-note";
import { trashNote } from "./trash-note";

describe("addNoteComment", () => {
  it("adds a member's comment to a live note, audited by id only", async () => {
    const ada = await seedUser("Ada Comment");
    const grace = await seedUser("Grace Comment");
    const owner = await seedWorkspace(ada.id, { id: "ws-notes-comment" });
    const member = await addMember(owner.workspaceId, grace.id);
    const note = await createNote(useCaseDeps(), owner, { title: "Q3" });

    const comment = await addNoteComment(useCaseDeps(), member, {
      noteId: note.id,
      body: "  The drill is booked  ",
    });
    expect(
      await rows(
        "SELECT workspace_id, note_id, body, created_by FROM note_comments WHERE id = ?",
        comment.id
      )
    ).toEqual([
      {
        workspace_id: "ws-notes-comment",
        note_id: note.id,
        body: "The drill is booked",
        created_by: grace.id,
      },
    ]);
    const event = (await auditTrail("ws-notes-comment")).at(-1);
    expect(event).toMatchObject({
      action: "note.commented",
      actor: grace.id,
      target: `note:${note.id}`,
      metadata: { commentId: comment.id },
    });
    expect(JSON.stringify(event)).not.toContain("drill");
  });

  it("refuses a comment on a trashed note or one of another workspace", async () => {
    const ada = await seedUser("Ada Comment Hidden");
    const eve = await seedUser("Eve Comment Outsider");
    const actor = await seedWorkspace(ada.id, {
      id: "ws-notes-comment-hidden",
    });
    const outsider = await seedWorkspace(eve.id, {
      id: "ws-notes-comment-outsider",
    });
    const note = await createNote(useCaseDeps(), actor, { title: "Mine" });

    await expect(
      addNoteComment(useCaseDeps(), outsider, { noteId: note.id, body: "Hi" })
    ).rejects.toMatchObject({ kind: "not_found" });
    await trashNote(useCaseDeps(), actor, { noteId: note.id });
    await expect(
      addNoteComment(useCaseDeps(), actor, { noteId: note.id, body: "Late" })
    ).rejects.toMatchObject({ kind: "not_found" });
    expect(
      await rows("SELECT id FROM note_comments WHERE note_id = ?", note.id)
    ).toEqual([]);
  });
});
