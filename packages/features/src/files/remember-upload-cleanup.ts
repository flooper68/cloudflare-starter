import type { Database } from "../database";
import type { Clock } from "../kernel";
import { pendingFileCleanup } from "./files.schema";
/** Persist before attempting deletion; no FK can discard this target during erasure. */
export async function rememberUploadCleanup(
  deps: { readonly db: Database; readonly clock: Clock },
  input: { readonly r2Key: string; readonly workspaceId: string }
) {
  await deps.db
    .insert(pendingFileCleanup)
    .values({
      target: input.r2Key,
      kind: "upload",
      workspaceId: input.workspaceId,
      notBefore: deps.clock.now(),
      createdAt: deps.clock.now(),
    })
    .onConflictDoNothing();
}
