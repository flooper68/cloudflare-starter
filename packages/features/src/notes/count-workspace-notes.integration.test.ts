import { describe, expect, it } from "vitest";

import {
  seedUser,
  seedWorkspace,
  testDb,
  useCaseDeps,
} from "../../test/fixtures";
import { measureMetric } from "../billing";
import { countWorkspaceNotes } from "./count-workspace-notes";
import { createNote } from "./create-note";
import { trashNote } from "./trash-note";

describe("countWorkspaceNotes", () => {
  it("counts the workspace's live notes, as billing's notes metric", async () => {
    const ada = await seedUser("Ada Count");
    const eve = await seedUser("Eve Count");
    const actor = await seedWorkspace(ada.id, { id: "ws-notes-count" });
    const other = await seedWorkspace(eve.id, { id: "ws-notes-count-other" });
    await createNote(useCaseDeps(), actor, { title: "One" });
    const two = await createNote(useCaseDeps(), actor, { title: "Two" });
    await createNote(useCaseDeps(), other, { title: "Elsewhere" });
    await trashNote(useCaseDeps(), actor, { noteId: two.id });

    const deps = { db: testDb() };
    expect(
      await countWorkspaceNotes(deps, { workspaceId: actor.workspaceId })
    ).toBe(1);
    expect(await measureMetric(useCaseDeps(), actor.workspaceId, "notes")).toBe(
      1
    );
  });
});
