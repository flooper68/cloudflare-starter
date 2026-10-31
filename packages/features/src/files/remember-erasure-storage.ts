import { sql } from "drizzle-orm";
import type { Database } from "../database";
import type { Clock } from "../kernel";
import { PRESIGNED_UPLOAD_CLEANUP_DELAY_SECONDS } from "./domain";
import { pendingFileCleanup } from "./files.schema";
/** Save workspace/avatar prefixes BEFORE their metadata disappears, including partial erasures. */
export async function rememberErasureStorage(
  deps: { readonly db: Database; readonly clock: Clock },
  input: {
    readonly userId: string;
    readonly workspaceIds: readonly string[];
    readonly includeAvatar?: boolean;
  }
) {
  const now = deps.clock.now();
  const notBefore = new Date(
    now.getTime() + PRESIGNED_UPLOAD_CLEANUP_DELAY_SECONDS * 1000
  );
  const t = pendingFileCleanup;
  const targets: { target: string; workspaceId: string | null }[] =
    input.workspaceIds.map((id) => ({
      target: `workspaces/${id}/`,
      workspaceId: id,
    }));
  if (input.includeAvatar)
    targets.push({
      target: `users/${input.userId}/avatar/`,
      workspaceId: null,
    });
  for (const target of targets)
    await deps.db
      .insert(t)
      .values({
        target: target.target,
        kind: "erasure",
        workspaceId: target.workspaceId,
        userId: input.userId,
        notBefore,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: t.target,
        set: {
          notBefore: sql`max(${t.notBefore},${notBefore.getTime()})`,
          cursor: null,
          sweep: 0,
        },
      });
}
