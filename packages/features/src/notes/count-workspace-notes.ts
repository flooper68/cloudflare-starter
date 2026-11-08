import { and, count, eq, isNull } from "drizzle-orm";

import type { Database } from "../database";
import { notes } from "./notes.schema";

/**
 * Billing's `notes` metric: the workspace's live notes (trashed ones do not count, so
 * restoring one checks the limit again). For a workspace its caller authorized.
 */
export async function countWorkspaceNotes(
  deps: { readonly db: Database },
  input: { readonly workspaceId: string }
): Promise<number> {
  const [row] = await deps.db
    .select({ value: count() })
    .from(notes)
    .where(
      and(eq(notes.workspaceId, input.workspaceId), isNull(notes.deletedAt))
    );
  return row?.value ?? 0;
}
