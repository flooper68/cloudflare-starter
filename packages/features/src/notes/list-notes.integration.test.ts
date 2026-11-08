import { describe, expect, it } from "vitest";

import { seedUser, seedWorkspace, useCaseDeps } from "../../test/fixtures";
import { addNoteComment } from "./add-note-comment";
import { createNote } from "./create-note";
import { listNotes } from "./list-notes";
import { trashNote } from "./trash-note";
import { updateNote } from "./update-note";

describe("listNotes", () => {
  it("lists live notes of the workspace only, most recently changed first, with people and comment counts", async () => {
    const ada = await seedUser("Ada List");
    const grace = await seedUser("Grace List");
    const actor = await seedWorkspace(ada.id, { id: "ws-notes-list" });
    const other = await seedWorkspace(grace.id, { id: "ws-notes-list-other" });

    const older = await createNote(
      useCaseDeps("2026-11-01T09:00:00.000Z"),
      actor,
      { title: "Interview notes", body: "\nBabbage and Co\nSecond line" }
    );
    const newer = await createNote(
      useCaseDeps("2026-11-02T09:00:00.000Z"),
      actor,
      { title: "Pricing page copy" }
    );
    const trashed = await createNote(
      useCaseDeps("2026-11-03T09:00:00.000Z"),
      actor,
      { title: "Old draft" }
    );
    await trashNote(useCaseDeps("2026-11-04T09:00:00.000Z"), actor, {
      noteId: trashed.id,
    });
    await createNote(useCaseDeps(), other, { title: "Someone else's" });
    // Editing the older note moves it to the top; a comment is counted.
    await updateNote(useCaseDeps("2026-11-05T09:00:00.000Z"), actor, {
      noteId: older.id,
      title: "Interview notes · Babbage and Co",
    });
    await addNoteComment(useCaseDeps(), actor, {
      noteId: older.id,
      body: "Booked for Thursday",
    });

    const { items } = await listNotes(useCaseDeps(), actor, {});
    expect(items.map((note) => note.id)).toEqual([older.id, newer.id]);
    expect(items[0]).toEqual({
      id: older.id,
      title: "Interview notes · Babbage and Co",
      excerpt: "Babbage and Co",
      createdBy: { userId: ada.id, name: "Ada List" },
      createdAt: "2026-11-01T09:00:00.000Z",
      updatedBy: { userId: ada.id, name: "Ada List" },
      updatedAt: "2026-11-05T09:00:00.000Z",
      commentCount: 1,
    });
    expect(items[1]?.commentCount).toBe(0);
  });

  it("searches titles case-insensitively, with % and _ matched literally", async () => {
    const ada = await seedUser("Ada Search");
    const actor = await seedWorkspace(ada.id, { id: "ws-notes-search" });
    await createNote(useCaseDeps(), actor, { title: "Q3 launch checklist" });
    await createNote(useCaseDeps(), actor, { title: "100% done" });
    await createNote(useCaseDeps(), actor, { title: "Support macros" });

    const titles = async (query: string) =>
      (await listNotes(useCaseDeps(), actor, { query })).items.map(
        (note) => note.title
      );
    expect(await titles("LAUNCH")).toEqual(["Q3 launch checklist"]);
    expect(await titles("%")).toEqual(["100% done"]);
    expect(await titles("_")).toEqual([]);
  });

  it("is empty for a workspace without notes", async () => {
    const ada = await seedUser("Ada Empty");
    const actor = await seedWorkspace(ada.id, { id: "ws-notes-empty" });
    expect(await listNotes(useCaseDeps(), actor, {})).toEqual({ items: [] });
  });
});
