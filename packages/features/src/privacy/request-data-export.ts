import { eq, sql } from "drizzle-orm";
import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import { enqueueJob } from "../jobs";
import type { Clock, Ids, RequestContext } from "../kernel";
import type { JobQueue } from "../platform";
import { authorizeExport } from "./authorize-export";
import { dataExportJob, ExportLimitError } from "./domain";
import { dataRequests } from "./privacy.schema";
/** One atomic INSERT…SELECT enforces both the rolling count and unique active-subject index. */
export async function requestDataExport(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly jobQueue: JobQueue;
  },
  userId: string,
  input: { readonly workspaceId?: string } = {}
) {
  const scope = input.workspaceId ? "workspace" : "user";
  const subjectId = input.workspaceId ?? userId;
  await authorizeExport(deps, {
    userId,
    scope,
    workspaceId: input.workspaceId ?? null,
  });
  const id = deps.ids.uuid();
  const now = deps.clock.now().getTime();
  const inserted = await deps.db.all<{ id: string }>(
    sql`INSERT INTO data_requests (id,user_id,scope,subject_id,status,created_at) SELECT ${id},${userId},${scope},${subjectId},'queued',${now} WHERE (SELECT count(*) FROM data_requests WHERE scope=${scope} AND subject_id=${subjectId} AND created_at>${now - 86400000}) < 3 AND EXISTS (SELECT 1 FROM user WHERE id=${userId}) AND NOT EXISTS (SELECT 1 FROM privacy_erasure_lock WHERE user_id=${userId}) ON CONFLICT DO NOTHING RETURNING id`
  );
  if (inserted.length === 0) throw new ExportLimitError();
  try {
    await enqueueJob(
      deps,
      dataExportJob,
      { requestId: id },
      { context: deps.requestContext }
    );
  } catch (error) {
    await deps.db.delete(dataRequests).where(eq(dataRequests.id, id));
    throw error;
  }
  await recordAuditEvent(deps, deps.requestContext, {
    action: "privacy.export_requested",
    target: { type: "data_request", id },
    metadata: { scope, subjectId },
  });
  return { id, status: "queued" as const };
}
