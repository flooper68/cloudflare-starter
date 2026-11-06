import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { BillingGate, Clock, Ids, RequestContext } from "../kernel";
import type { ProductAnalytics } from "../platform";
import { trackEvent } from "../product-analytics";
import { type Actor, requirePermission } from "../workspaces";
import {
  type CreateNoteInput,
  createNoteInputSchema,
  noteCreatedEvent,
  noteLengthBucket,
} from "./domain";
import { notes } from "./notes.schema";

/**
 * Writes a new note in the actor's workspace. Checks, in order: the permission
 * (`notes.write`), then the plan's `notes` limit (live notes; a refusal is
 * `limit_reached`). Records `note.created` and the `notes.created` product event.
 */
export async function createNote(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly billing: BillingGate;
    readonly analytics: ProductAnalytics;
  },
  actor: Actor,
  input: CreateNoteInput
): Promise<{ readonly id: string; readonly createdAt: string }> {
  requirePermission(actor, "notes.write");
  const parsed = createNoteInputSchema.parse(input);
  await deps.billing.requireLimit(actor.workspaceId, "notes", 1);

  const id = deps.ids.uuid();
  const now = deps.clock.now();
  await deps.db.insert(notes).values({
    id,
    workspaceId: actor.workspaceId,
    title: parsed.title,
    body: parsed.body,
    createdBy: actor.userId,
    createdAt: now,
    updatedBy: actor.userId,
    updatedAt: now,
  });

  await recordAuditEvent(deps, deps.requestContext, {
    action: "note.created",
    actor: { kind: "user", userId: actor.userId },
    workspaceId: actor.workspaceId,
    target: { type: "note", id },
  });
  trackEvent(
    deps,
    {
      ...deps.requestContext,
      userId: actor.userId,
      workspaceId: actor.workspaceId,
    },
    noteCreatedEvent,
    { length: noteLengthBucket(parsed.body) }
  );
  return { id, createdAt: now.toISOString() };
}
