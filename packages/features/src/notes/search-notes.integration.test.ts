import { describe, expect, it } from "vitest";

import {
  addMember,
  seedUser,
  seedWorkspace,
  useCaseDeps,
} from "../../test/fixtures";
import { createNote } from "./create-note";
import { searchNotes } from "./search-notes";
import { trashNote } from "./trash-note";

describe("searchNotes", () => {
  it("finds live notes of the workspace by title or body, title matches first, never trashed or other workspaces' notes", async () => {
    const ada = await seedUser("Ada Palette");
    const grace = await seedUser("Grace Palette");
    const actor = await seedWorkspace(ada.id, { id: "ws-notes-find" });
    const other = await seedWorkspace(grace.id, { id: "ws-notes-find-other" });

    const inBody = await createNote(
      useCaseDeps("2026-11-02T09:00:00.000Z"),
      actor,
      { title: "Weekly sync", body: "\nAgenda: the Launch plan\nMore" }
    );
    const inTitle = await createNote(
      useCaseDeps("2026-11-01T09:00:00.000Z"),
      actor,
      { title: "Q3 launch checklist", body: "Freeze the pricing page" }
    );
    const trashed = await createNote(useCaseDeps(), actor, {
      title: "Launch draft",
    });
    await trashNote(useCaseDeps(), actor, { noteId: trashed.id });
    await createNote(useCaseDeps(), other, { title: "Their launch" });
    await createNote(useCaseDeps(), actor, { title: "Support macros" });

    expect(
      await searchNotes(useCaseDeps(), actor, { query: "LAUNCH" })
    ).toEqual({
      items: [
        {
          id: inTitle.id,
          title: "Q3 launch checklist",
          excerpt: "Freeze the pricing page",
          matched: "title",
        },
        {
          id: inBody.id,
          title: "Weekly sync",
          excerpt: "Agenda: the Launch plan",
          matched: "body",
        },
      ],
    });
  });

  it("matches % and _ literally, caps the hits and lets members search", async () => {
    const ada = await seedUser("Ada Cap");
    const grace = await seedUser("Grace Cap");
    const owner = await seedWorkspace(ada.id, { id: "ws-notes-find-cap" });
    const member = await addMember(owner.workspaceId, grace.id, "member");
    for (const title of ["100% done", "Plan A", "Plan B", "Plan C"]) {
      await createNote(useCaseDeps(), owner, { title });
    }

    const titles = async (query: string, limit?: number) =>
      (await searchNotes(useCaseDeps(), member, { query, limit })).items.map(
        (note) => note.title
      );
    expect(await titles("%")).toEqual(["100% done"]);
    expect(await titles("_")).toEqual([]);
    expect(await titles("plan", 2)).toHaveLength(2);
  });

  it("refuses an empty query", async () => {
    const ada = await seedUser("Ada Blank");
    const actor = await seedWorkspace(ada.id, { id: "ws-notes-find-blank" });
    await expect(
      searchNotes(useCaseDeps(), actor, { query: "  " })
    ).rejects.toThrow();
  });
});
