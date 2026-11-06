import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  billingDeps,
  rows,
  seedUser,
  seedWorkspace,
  testBilling,
  testDb,
  useCaseDeps,
} from "../../test/fixtures";
import { setOverride } from "../billing";
import { DATA_CATALOG } from "../data-catalog";
import { readExportPage } from "../privacy";
import { restoreItems } from "../trash";
import { TRASH_CATALOG } from "../trash-catalog";
import { addNoteComment } from "./add-note-comment";
import { createNote } from "./create-note";
import { noteTrash } from "./trash";
import { trashNote } from "./trash-note";

const bucket = env.FILES;

describe("noteTrash", () => {
  it("is the note entity: 30 days, restored with notes.write, summarised by title", async () => {
    expect(noteTrash).toMatchObject({
      type: "note",
      retentionDays: 30,
      permission: "notes.write",
    });
    const ada = await seedUser("Ada Entity");
    const actor = await seedWorkspace(ada.id, { id: "ws-note-entity" });
    const note = await createNote(useCaseDeps(), actor, { title: "Roadmap" });
    const [row] = await testDb().query.notes.findMany({
      where: (notes, { eq }) => eq(notes.id, note.id),
    });
    if (!row) throw new Error("note row missing");
    expect(noteTrash.summarize(row)).toEqual({
      label: "Roadmap",
      sizeBytes: null,
    });
  });

  it("purges only trashed notes, with their comments, and is idempotent", async () => {
    const ada = await seedUser("Ada Purge");
    const actor = await seedWorkspace(ada.id, { id: "ws-note-purge" });
    const live = await createNote(useCaseDeps(), actor, { title: "Keep" });
    const gone = await createNote(useCaseDeps(), actor, { title: "Drop" });
    await addNoteComment(useCaseDeps(), actor, { noteId: gone.id, body: "x" });
    await trashNote(useCaseDeps(), actor, { noteId: gone.id });

    const deps = { db: testDb(), bucket };
    const deleted: string[] = [];
    expect(
      await noteTrash.purge(deps, [live.id, gone.id], {
        trashedOnly: true,
        onRowsDeleted: async (ids) => {
          deleted.push(...ids);
        },
      })
    ).toEqual({ purgedIds: [gone.id] });
    expect(deleted).toEqual([gone.id]);
    expect(
      await rows("SELECT id FROM notes WHERE workspace_id = ?", "ws-note-purge")
    ).toEqual([{ id: live.id }]);
    expect(
      await rows("SELECT id FROM note_comments WHERE note_id = ?", gone.id)
    ).toEqual([]);
    expect(
      await noteTrash.purge(deps, [gone.id], { trashedOnly: true })
    ).toEqual({ purgedIds: [] });
    // Erasure passes trashedOnly false: live notes go too.
    expect(
      await noteTrash.purge(deps, [live.id], { trashedOnly: false })
    ).toEqual({ purgedIds: [live.id] });
  });

  it("refuses to restore past the notes limit (trashed notes free their place)", async () => {
    const ada = await seedUser("Ada Restore Limit");
    const admin = await seedUser("Alan Restore Admin");
    const actor = await seedWorkspace(ada.id, { id: "ws-note-restore-limit" });
    const first = await createNote(useCaseDeps(), actor, { title: "First" });
    await trashNote(useCaseDeps(), actor, { noteId: first.id });
    await setOverride(
      billingDeps(),
      { userId: admin.id },
      {
        workspaceId: actor.workspaceId,
        key: "notes",
        override: { kind: "limit", limit: 1 },
        reason: "One note for the test",
      }
    );
    const billing = testBilling("manual");
    await createNote({ ...useCaseDeps(), billing }, actor, { title: "Second" });

    await expect(
      restoreItems(
        { ...useCaseDeps(), billing, entities: TRASH_CATALOG },
        actor,
        { items: [{ type: "note", id: first.id }] }
      )
    ).rejects.toMatchObject({
      kind: "limit_reached",
      details: { metric: "notes", limit: 1 },
    });
  });

  it("exports the person's own notes and comments with the whitelisted columns; deleting the workspace deletes them", async () => {
    const ada = await seedUser("Ada Export");
    const actor = await seedWorkspace(ada.id, { id: "ws-note-export" });
    const note = await createNote(useCaseDeps(), actor, {
      title: "Exported",
      body: "Body",
    });
    await addNoteComment(useCaseDeps(), actor, { noteId: note.id, body: "Hi" });
    const entity = (table: string) => {
      const found = DATA_CATALOG.find((item) => item.table === table);
      if (!found) throw new Error(`${table} missing from DATA_CATALOG`);
      return found;
    };
    const subject = {
      userId: ada.id,
      scope: "user" as const,
      workspaceId: null,
    };
    const exported = await readExportPage(
      { db: testDb() },
      entity("notes"),
      subject,
      0
    );
    expect(exported).toHaveLength(1);
    expect(exported[0]).toMatchObject({ id: note.id, title: "Exported" });
    expect(Object.keys(exported[0] ?? {}).sort()).toEqual(
      ["_rowid", ...entity("notes").columns].sort()
    );
    expect(
      await readExportPage(
        { db: testDb() },
        entity("note_comments"),
        subject,
        0
      )
    ).toEqual([expect.objectContaining({ body: "Hi", note_id: note.id })]);

    await env.DB.prepare("DELETE FROM workspaces WHERE id = ?")
      .bind("ws-note-export")
      .run();
    expect(await rows("SELECT id FROM notes WHERE id = ?", note.id)).toEqual(
      []
    );
    expect(
      await rows("SELECT id FROM note_comments WHERE note_id = ?", note.id)
    ).toEqual([]);
  });
});
