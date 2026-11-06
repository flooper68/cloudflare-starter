import { describe, expect, it } from "vitest";

import {
  addMember,
  auditTrail,
  rows,
  seedUser,
  seedWorkspace,
  useCaseDeps,
} from "../../test/fixtures";
import { createNote } from "./create-note";
import { trashNote } from "./trash-note";
import { updateNote } from "./update-note";

describe("updateNote", () => {
  it("changes only the fields given, records who and which fields (never the text)", async () => {
    const ada = await seedUser("Ada Update");
    const grace = await seedUser("Grace Update");
    const owner = await seedWorkspace(ada.id, { id: "ws-notes-update" });
    const member = await addMember(owner.workspaceId, grace.id);
    const note = await createNote(useCaseDeps(), owner, {
      title: "Draft",
      body: "First body",
    });

    expect(
      await updateNote(useCaseDeps("2026-11-02T08:00:00.000Z"), member, {
        noteId: note.id,
        body: "Second body",
      })
    ).toEqual({ id: note.id, updatedAt: "2026-11-02T08:00:00.000Z" });
    expect(
      await rows(
        "SELECT title, body, created_by, updated_by FROM notes WHERE id = ?",
        note.id
      )
    ).toEqual([
      {
        title: "Draft",
        body: "Second body",
        created_by: ada.id,
        updated_by: grace.id,
      },
    ]);
    const trail = await auditTrail("ws-notes-update");
    expect(trail.at(-1)).toMatchObject({
      action: "note.updated",
      actor: grace.id,
      target: `note:${note.id}`,
      metadata: { fields: ["body"] },
    });
    expect(JSON.stringify(trail)).not.toContain("Second body");
  });

  it("is not found for a trashed note or one of another workspace", async () => {
    const ada = await seedUser("Ada Update Hidden");
    const eve = await seedUser("Eve Update Outsider");
    const actor = await seedWorkspace(ada.id, { id: "ws-notes-update-hidden" });
    const outsider = await seedWorkspace(eve.id, {
      id: "ws-notes-update-outsider",
    });
    const note = await createNote(useCaseDeps(), actor, { title: "Mine" });

    await expect(
      updateNote(useCaseDeps(), outsider, { noteId: note.id, title: "Taken" })
    ).rejects.toMatchObject({ kind: "not_found" });
    await trashNote(useCaseDeps(), actor, { noteId: note.id });
    await expect(
      updateNote(useCaseDeps(), actor, { noteId: note.id, title: "Late" })
    ).rejects.toMatchObject({ kind: "not_found" });
    expect(await rows("SELECT title FROM notes WHERE id = ?", note.id)).toEqual(
      [{ title: "Mine" }]
    );
  });
});
