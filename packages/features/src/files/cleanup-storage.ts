import { and, eq } from "drizzle-orm";
import { user } from "../accounts";
import type { Database } from "../database";
import { enqueueJob } from "../jobs";
import type { Clock, Ids, RequestContext } from "../kernel";
import type { JobQueue } from "../platform";
import { workspaces } from "../workspaces";
import { cleanupStorageJob } from "./domain";
import { pendingFileCleanup } from "./files.schema";
import { findReferencedFileKeys } from "./find-referenced-file-keys";
/** Targeted cleanup, independent of optional reconciliation. Intent/cursor advance only after successful I/O. */
export async function cleanupStorage(
  deps: {
    readonly db: Database;
    readonly bucket: R2Bucket;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly jobQueue: JobQueue;
    readonly requestContext: RequestContext;
  },
  input: { readonly target: string }
) {
  const t = pendingFileCleanup;
  const [intent] = await deps.db
    .select()
    .from(t)
    .where(eq(t.target, input.target));
  if (!intent) return { deleted: 0, retained: false };
  if (intent.notBefore > deps.clock.now()) {
    await enqueueJob(deps, cleanupStorageJob, input, {
      context: deps.requestContext,
      delaySeconds: Math.min(
        86400,
        Math.ceil(
          (intent.notBefore.getTime() - deps.clock.now().getTime()) / 1000
        )
      ),
    });
    return { deleted: 0, retained: true };
  }
  if (intent.kind === "upload") {
    const referenced = await findReferencedFileKeys(deps, [intent.target]);
    if (!referenced.has(intent.target)) await deps.bucket.delete(intent.target);
    await deps.db.delete(t).where(eq(t.target, intent.target));
    return { deleted: referenced.size ? 0 : 1, retained: false };
  }
  async function mayErase() {
    const [workspace] = intent.workspaceId
      ? await deps.db
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(eq(workspaces.id, intent.workspaceId))
      : [];
    const [owner] = intent.userId
      ? await deps.db
          .select({ id: user.id })
          .from(user)
          .where(eq(user.id, intent.userId))
      : [];
    return !workspace && !owner;
  }
  if (!(await mayErase())) return { deleted: 0, retained: true };
  const page = await deps.bucket.list({
    prefix: intent.target,
    cursor: intent.cursor ?? undefined,
    limit: 100,
  });
  if (!(await mayErase())) return { deleted: 0, retained: true };
  const keys = page.objects.map((object) => object.key);
  const referenced = await findReferencedFileKeys(deps, keys);
  const deletable = keys.filter((key) => !referenced.has(key));
  if (deletable.length) await deps.bucket.delete(deletable);
  if (referenced.size) return { deleted: deletable.length, retained: true };
  if (page.truncated) {
    await deps.db
      .update(t)
      .set({ cursor: page.cursor })
      .where(and(eq(t.target, intent.target), eq(t.kind, "erasure")));
    await enqueueJob(deps, cleanupStorageJob, input, {
      context: deps.requestContext,
    });
  } else if (intent.sweep === 0) {
    await deps.db
      .update(t)
      .set({
        sweep: 1,
        cursor: null,
        notBefore: new Date(deps.clock.now().getTime() + 86400000),
      })
      .where(eq(t.target, intent.target));
    await enqueueJob(deps, cleanupStorageJob, input, {
      context: deps.requestContext,
      delaySeconds: 86400,
    });
    return { deleted: deletable.length, retained: true };
  } else await deps.db.delete(t).where(eq(t.target, intent.target));
  return { deleted: deletable.length, retained: page.truncated };
}
