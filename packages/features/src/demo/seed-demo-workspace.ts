import { eq } from "drizzle-orm";

import type { Database } from "../database";
import type { BillingGate, Clock, Ids, RequestContext } from "../kernel";
import { addNoteComment, createNote, notes } from "../notes";
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
        | "already_has_notes";
    };

/**
 * Handler of `demo.seed-workspace`: writes the sample notes (DEMO_SAMPLE_NOTES, one with
 * a comment) into a new personal workspace through the Notes use cases, as its owner, so
 * permissions, the plan's notes limit, audit events and product events apply as for any
 * note. Idempotent: a workspace that has any note (live or in the trash) is left alone,
 * and the job is keyed by workspace. Settings are re-read when it runs, so a demo turned
 * off meanwhile seeds nothing.
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

  const [existing] = await deps.db
    .select({ id: notes.id })
    .from(notes)
    .where(eq(notes.workspaceId, input.workspaceId))
    .limit(1);
  if (existing) return { seeded: false, reason: "already_has_notes" };

  const actor = await resolveActor(deps, {
    userId: input.userId,
    mode: demo.workspaceMode,
    workspaceId: input.workspaceId,
  });
  let comments = 0;
  // Oldest first, so the welcome note is listed on top (newest first).
  for (const sample of [...DEMO_SAMPLE_NOTES].reverse()) {
    const note = await createNote(deps, actor, {
      title: sample.title,
      body: sample.body,
    });
    for (const body of sample.comments) {
      await addNoteComment(deps, actor, { noteId: note.id, body });
      comments += 1;
    }
  }
  return { seeded: true, notes: DEMO_SAMPLE_NOTES.length, comments };
}
