import { beforeEach, describe, expect, it } from "vitest";

import {
  DEMO_NOW,
  demoOn,
  resetDemoState,
  seedDemoUser,
} from "../../test/demo-fixtures";
import {
  auditTrail,
  rows,
  seedWorkspace,
  testBilling,
  useCaseDeps,
} from "../../test/fixtures";
import { DEMO_SAMPLE_NOTES } from "./domain";
import { seedDemoWorkspace } from "./seed-demo-workspace";

function deps(demo = demoOn()) {
  return { ...useCaseDeps(DEMO_NOW), demo };
}

describe("seedDemoWorkspace", () => {
  beforeEach(resetDemoState);

  it("writes the sample notes and one comment through the Notes use cases", async () => {
    const visitor = await seedDemoUser("seed@example.test", new Date(DEMO_NOW));
    const d = deps();
    expect(
      await seedDemoWorkspace(d, {
        userId: visitor.id,
        workspaceId: visitor.workspaceId,
      })
    ).toEqual({ seeded: true, notes: DEMO_SAMPLE_NOTES.length, comments: 1 });

    const notes = await rows(
      "SELECT title, created_by FROM notes WHERE workspace_id = ? ORDER BY title",
      visitor.workspaceId
    );
    expect(notes.map((note) => note.title)).toEqual(
      DEMO_SAMPLE_NOTES.map((note) => note.title).sort()
    );
    expect(notes.every((note) => note.created_by === visitor.id)).toBe(true);
    expect(
      await rows(
        "SELECT body FROM note_comments WHERE workspace_id = ?",
        visitor.workspaceId
      )
    ).toEqual([{ body: DEMO_SAMPLE_NOTES[0]?.comments[0] }]);
    // Audited and tracked like any note.
    const actions = (await auditTrail(visitor.workspaceId)).map(
      (e) => e.action
    );
    expect(actions.filter((a) => a === "note.created")).toHaveLength(3);
    expect(actions).toContain("note.commented");
    expect(
      d.analytics.recorded.filter((call) => call.event === "notes.created")
    ).toHaveLength(3);
  });

  it("is idempotent: a seeded workspace (even with its samples trashed) gets nothing more", async () => {
    const visitor = await seedDemoUser(
      "twice@example.test",
      new Date(DEMO_NOW)
    );
    const input = { userId: visitor.id, workspaceId: visitor.workspaceId };
    await seedDemoWorkspace(deps(), input);
    expect(await seedDemoWorkspace(deps(), input)).toEqual({
      seeded: false,
      reason: "already_seeded",
    });
    await rows(
      "UPDATE notes SET deleted_at = ?, deleted_by = ? WHERE workspace_id = ?",
      Date.parse(DEMO_NOW),
      visitor.id,
      visitor.workspaceId
    );
    expect((await seedDemoWorkspace(deps(), input)).seeded).toBe(false);
    expect(
      await rows(
        "SELECT count(*) AS n FROM notes WHERE workspace_id = ?",
        visitor.workspaceId
      )
    ).toEqual([{ n: DEMO_SAMPLE_NOTES.length }]);
    expect(
      await rows(
        "SELECT count(*) AS n FROM note_comments WHERE workspace_id = ?",
        visitor.workspaceId
      )
    ).toEqual([{ n: 1 }]);
  });

  it("completes a partly written seed on retry", async () => {
    const visitor = await seedDemoUser(
      "partial@example.test",
      new Date(DEMO_NOW)
    );
    const input = { userId: visitor.id, workspaceId: visitor.workspaceId };
    let calls = 0;
    const failing = {
      ...deps(),
      billing: {
        ...testBilling(),
        requireLimit: async () => {
          calls += 1;
          if (calls > 1) throw new Error("D1 hiccup");
        },
      },
    };
    await expect(seedDemoWorkspace(failing, input)).rejects.toThrow(
      "D1 hiccup"
    );
    expect(
      await rows(
        "SELECT count(*) AS n FROM notes WHERE workspace_id = ?",
        visitor.workspaceId
      )
    ).toEqual([{ n: 1 }]);
    expect(await seedDemoWorkspace(deps(), input)).toEqual({
      seeded: true,
      notes: DEMO_SAMPLE_NOTES.length - 1,
      comments: 1,
    });
    expect(
      await rows(
        "SELECT count(*) AS n FROM notes WHERE workspace_id = ?",
        visitor.workspaceId
      )
    ).toEqual([{ n: DEMO_SAMPLE_NOTES.length }]);
  });

  it("leaves a workspace with a note of the person's own alone", async () => {
    const visitor = await seedDemoUser("own@example.test", new Date(DEMO_NOW));
    await rows(
      "INSERT INTO notes (id, workspace_id, title, body, created_by, updated_by, created_at, updated_at) VALUES ('note-own', ?, 'My plan', 'Mine', ?, ?, ?, ?)",
      visitor.workspaceId,
      visitor.id,
      visitor.id,
      Date.parse(DEMO_NOW),
      Date.parse(DEMO_NOW)
    );
    expect(
      await seedDemoWorkspace(deps(), {
        userId: visitor.id,
        workspaceId: visitor.workspaceId,
      })
    ).toEqual({ seeded: false, reason: "already_has_notes" });
  });

  it("seeds nothing with demo mode or sample data off, or in another workspace", async () => {
    const visitor = await seedDemoUser("off@example.test", new Date(DEMO_NOW));
    const input = { userId: visitor.id, workspaceId: visitor.workspaceId };
    expect(await seedDemoWorkspace(deps({ mode: "off" }), input)).toEqual({
      seeded: false,
      reason: "demo_off",
    });
    expect(
      await seedDemoWorkspace(deps(demoOn({ sampleData: false })), input)
    ).toEqual({ seeded: false, reason: "sample_data_off" });
    const shared = await seedWorkspace(visitor.id, { id: "ws-shared-seed" });
    expect(
      await seedDemoWorkspace(deps(), {
        userId: visitor.id,
        workspaceId: shared.workspaceId,
      })
    ).toEqual({ seeded: false, reason: "not_personal" });
    const other = await seedDemoUser("other@example.test", new Date(DEMO_NOW));
    expect(
      await seedDemoWorkspace(deps(), {
        userId: visitor.id,
        workspaceId: other.workspaceId,
      })
    ).toEqual({ seeded: false, reason: "not_personal" });
    expect(await rows("SELECT id FROM notes")).toEqual([]);
  });

  it("respects the plan's notes limit like any note", async () => {
    const visitor = await seedDemoUser(
      "limit@example.test",
      new Date(DEMO_NOW)
    );
    const d = {
      ...deps(),
      billing: {
        ...testBilling(),
        requireLimit: async () => {
          throw new Error("limit_reached");
        },
      },
    };
    await expect(
      seedDemoWorkspace(d, {
        userId: visitor.id,
        workspaceId: visitor.workspaceId,
      })
    ).rejects.toThrow("limit_reached");
  });
});
