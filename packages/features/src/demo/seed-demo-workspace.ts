import { eq, inArray } from "drizzle-orm";

import type { Database } from "../database";
import type { BillingGate, Clock, Ids, RequestContext } from "../kernel";
import { addNoteComment, createNote, noteComments, notes } from "../notes";
import type { ProductAnalytics } from "../platform";
import { resolveActor, workspaces } from "../workspaces";
import { DEMO_SAMPLE_NOTES, type DemoRuntime } from "./domain";

export type SeedDemoWorkspaceResult =
  | { readonly seeded: true; readonly notes: number; readonly comments: number }
  | {
      readonly seeded: false;
      readonly reason:
        | "demo_off"
        | "sample_data_off"
        | "not_personal"
        | "already_has_notes"
        | "already_seeded";
    };

/**
 * Handler of `demo.seed-workspace`: writes the sample notes (DEMO_SAMPLE_NOTES, one with
 * a comment) into a new personal workspace through the Notes use cases, as its owner, so
 * permissions, the plan's notes limit, audit events and product events apply as for any
 * note. Idempotent and resumable: a workspace with a note of the person's own (live or in
 * the trash) is left alone; otherwise only the sample notes and comments still missing
 * are written, so a retry after a partial failure completes the set and a later run
 * writes nothing (`already_seeded`). The job is keyed by workspace. Settings are re-read
 * when it runs, so a demo turned off meanwhile seeds nothing.
 */
export async function seedDemoWorkspace(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly billing: BillingGate;
    readonly analytics: ProductAnalytics;
    readonly demo: DemoRuntime;
  },
  input: { readonly userId: string; readonly workspaceId: string }
): Promise<SeedDemoWorkspaceResult> {
  const { demo } = deps;
  if (demo.mode !== "on") return { seeded: false, reason: "demo_off" };
  if (!demo.sampleData) return { seeded: false, reason: "sample_data_off" };

  const [workspace] = await deps.db
    .select({ kind: workspaces.kind, createdBy: workspaces.createdBy })
    .from(workspaces)
    .where(eq(workspaces.id, input.workspaceId))
    .limit(1);
  if (workspace?.kind !== "personal" || workspace.createdBy !== input.userId)
    return { seeded: false, reason: "not_personal" };

  // Every note of the workspace, live or trashed: the sample ones a run already wrote.
  const existing = await deps.db
    .select({ id: notes.id, title: notes.title })
    .from(notes)
    .where(eq(notes.workspaceId, input.workspaceId));
  const sampleTitles = new Set(DEMO_SAMPLE_NOTES.map((note) => note.title));
  if (existing.some((note) => !sampleTitles.has(note.title)))
    return { seeded: false, reason: "already_has_notes" };
  const written = new Map(existing.map((note) => [note.title, note.id]));
  const commented = new Set(
    written.size === 0
      ? []
      : (
          await deps.db
            .select({ noteId: noteComments.noteId })
            .from(noteComments)
            .where(inArray(noteComments.noteId, [...written.values()]))
        ).map((row) => row.noteId)
  );

  let actor: Awaited<ReturnType<typeof resolveActor>> | null = null;
  const as = async () => {
    actor ??= await resolveActor(deps, {
      userId: input.userId,
      mode: demo.workspaceMode,
      workspaceId: input.workspaceId,
    });
    return actor;
  };
  let created = 0;
  let comments = 0;
  // Oldest first, so the welcome note is listed on top (newest first).
  for (const sample of [...DEMO_SAMPLE_NOTES].reverse()) {
    let noteId = written.get(sample.title);
    if (!noteId) {
      noteId = (
        await createNote(deps, await as(), {
          title: sample.title,
          body: sample.body,
        })
      ).id;
      created += 1;
    } else if (commented.has(noteId)) {
      continue;
    }
    for (const body of sample.comments) {
      await addNoteComment(deps, await as(), { noteId, body });
      comments += 1;
    }
  }
  if (created === 0 && comments === 0)
    return { seeded: false, reason: "already_seeded" };
  return { seeded: true, notes: created, comments };
}
