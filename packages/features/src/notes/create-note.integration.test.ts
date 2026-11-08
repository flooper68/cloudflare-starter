import { describe, expect, it } from "vitest";

import {
  addMember,
  auditTrail,
  billingDeps,
  rows,
  seedUser,
  seedWorkspace,
  testBilling,
  useCaseDeps,
} from "../../test/fixtures";
import { setOverride } from "../billing";
import { createNote } from "./create-note";
import { trashNote } from "./trash-note";

describe("createNote", () => {
  it("writes a note in the actor's workspace, audited and tracked without its text", async () => {
    const ada = await seedUser("Ada Create");
    const grace = await seedUser("Grace Create");
    const owner = await seedWorkspace(ada.id, { id: "ws-notes-create" });
    const member = await addMember(owner.workspaceId, grace.id);
    const deps = useCaseDeps();

    const created = await createNote(deps, member, {
      title: "  Q3 launch checklist ",
      body: "Freeze the pricing page",
    });
    expect(created.createdAt).toBe("2026-10-28T12:00:00.000Z");
    expect(
      await rows(
        "SELECT workspace_id, title, body, created_by, updated_by, deleted_at FROM notes WHERE id = ?",
        created.id
      )
    ).toEqual([
      {
        workspace_id: "ws-notes-create",
        title: "Q3 launch checklist",
        body: "Freeze the pricing page",
        created_by: grace.id,
        updated_by: grace.id,
        deleted_at: null,
      },
    ]);
    expect(await auditTrail("ws-notes-create")).toEqual([
      expect.objectContaining({
        action: "note.created",
        actor: grace.id,
        target: `note:${created.id}`,
        metadata: {},
      }),
    ]);
    expect(
      deps.analytics.recorded.map((call) => [call.event, call.properties])
    ).toEqual([["notes.created", { length: "short" }]]);
  });

  it("refuses a note past the plan's notes limit; trashed notes do not count", async () => {
    const ada = await seedUser("Ada Limit");
    const admin = await seedUser("Alan Limit Admin");
    const actor = await seedWorkspace(ada.id, { id: "ws-notes-limit" });
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
    const deps = { ...useCaseDeps(), billing: testBilling("manual") };
    const first = await createNote(deps, actor, { title: "Only one" });
    await expect(
      createNote(deps, actor, { title: "One too many" })
    ).rejects.toMatchObject({
      kind: "limit_reached",
      details: { metric: "notes", limit: 1, current: 1, increment: 1 },
    });

    // In the trash it frees its place.
    await trashNote(useCaseDeps(), actor, { noteId: first.id });
    await expect(
      createNote(deps, actor, { title: "Room again" })
    ).resolves.toMatchObject({ id: expect.any(String) });
  });

  it("refuses invalid input before writing anything", async () => {
    const ada = await seedUser("Ada Invalid");
    const actor = await seedWorkspace(ada.id, { id: "ws-notes-invalid" });
    await expect(
      createNote(useCaseDeps(), actor, { title: "   " })
    ).rejects.toThrow();
    expect(
      await rows(
        "SELECT id FROM notes WHERE workspace_id = ?",
        "ws-notes-invalid"
      )
    ).toEqual([]);
  });
});
