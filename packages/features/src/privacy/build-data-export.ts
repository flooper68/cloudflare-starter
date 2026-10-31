import { and, eq, sql } from "drizzle-orm";
import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import { JOB_MAX_RETRIES } from "../jobs";
import {
  type Clock,
  DomainError,
  type Ids,
  type Notify,
  type RequestContext,
} from "../kernel";
import type { ErrorReporter, Zip } from "../platform";
import { authorizeExport } from "./authorize-export";
import {
  type DataEntity,
  EXPORT_LEASE_MS,
  EXPORT_TTL_MS,
  ExportLockedError,
  ExportUnavailableError,
  exportReadyNotification,
} from "./domain";
import { createExportLink } from "./export-link";
import { dataRequests } from "./privacy.schema";
import { writeExportArchive } from "./write-export-archive";
/** Exclusive durable attempt lease; a retry aborts stale multipart state and starts a fresh key. */
export async function buildDataExport(
  deps: {
    readonly db: Database;
    readonly bucket: R2Bucket;
    readonly zip: Zip;
    readonly catalog: readonly DataEntity[];
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly notify: Notify;
    readonly errors: ErrorReporter;
    readonly app: { readonly secret: string };
  },
  input: { readonly requestId: string; readonly attempts: number }
) {
  const t = dataRequests;
  const now = deps.clock.now();
  const attempt = deps.ids.uuid();
  const [prior] = await deps.db
    .select()
    .from(t)
    .where(eq(t.id, input.requestId));
  if (!prior || ["ready", "expired", "failed"].includes(prior.status)) return;
  const [request] = await deps.db
    .update(t)
    .set({
      status: "building",
      attemptId: attempt,
      leaseUntil: new Date(now.getTime() + EXPORT_LEASE_MS),
    })
    .where(
      and(
        eq(t.id, input.requestId),
        sql`(${t.status}='queued' OR (${t.status}='building' AND ${t.leaseUntil}<${now.getTime()}))`
      )
    )
    .returning();
  if (!request) throw new ExportLockedError();
  let objectKey: string | undefined = prior.objectKey ?? undefined;
  let multipart: R2MultipartUpload | undefined =
    prior.uploadId && objectKey
      ? deps.bucket.resumeMultipartUpload(objectKey, prior.uploadId)
      : undefined;
  try {
    // Keep prior references in scope until BOTH cleanup steps complete. A second failure
    // must not erase the only durable reference to private multipart/archive data.
    if (multipart) await multipart.abort();
    if (objectKey) await deps.bucket.delete(objectKey);
    multipart = undefined;
    objectKey = undefined;
    const subject = {
      userId: request.userId,
      scope: request.scope,
      workspaceId: request.scope === "workspace" ? request.subjectId : null,
    };
    await authorizeExport(deps, subject);
    objectKey = `exports/${request.id}/${attempt}.zip`;
    multipart = await deps.bucket.createMultipartUpload(objectKey, {
      httpMetadata: { contentType: "application/zip" },
    });
    await deps.db
      .update(t)
      .set({ objectKey, uploadId: multipart.uploadId })
      .where(and(eq(t.id, request.id), eq(t.attemptId, attempt)));
    const result = await writeExportArchive(deps, subject, {
      multipart,
      createdAt: request.createdAt.toISOString(),
    });
    await authorizeExport(deps, subject);
    await recordAuditEvent(deps, deps.requestContext, {
      action: "privacy.export_ready",
      target: { type: "data_request", id: request.id },
      metadata: { bytes: result.bytes },
    });
    const published = await deps.db
      .update(t)
      .set({
        status: "ready",
        expiresAt: new Date(deps.clock.now().getTime() + EXPORT_TTL_MS),
        sizeBytes: result.bytes,
        uploadId: null,
        leaseUntil: null,
      })
      .where(
        and(
          eq(t.id, request.id),
          eq(t.attemptId, attempt),
          eq(t.status, "building")
        )
      )
      .returning({ id: t.id });
    if (!published.length) {
      await deps.bucket.delete(objectKey);
      throw new ExportUnavailableError();
    }
    const link = await createExportLink(
      { ...deps, secret: deps.app.secret },
      request.userId,
      { requestId: request.id }
    );
    await deps.notify(exportReadyNotification, {
      recipients: [request.userId],
      data: { requestId: request.id, href: link.href },
      context: { workspaceId: null, requestContext: deps.requestContext },
    });
  } catch (error) {
    let cleaned = true;
    if (multipart) {
      try {
        await multipart.abort();
      } catch (cleanupError) {
        cleaned = false;
        deps.errors.capture(cleanupError, deps.requestContext, {
          "app.privacy.operation": "abort_export",
        });
      }
    }
    if (objectKey) {
      try {
        await deps.bucket.delete(objectKey);
      } catch (cleanupError) {
        cleaned = false;
        deps.errors.capture(cleanupError, deps.requestContext, {
          "app.privacy.operation": "delete_failed_export",
        });
      }
    }
    await deps.db
      .update(t)
      .set({
        status:
          input.attempts > JOB_MAX_RETRIES ||
          (error instanceof DomainError &&
            ["not_found", "forbidden", "invalid_input"].includes(error.kind))
            ? "failed"
            : "queued",
        failure: "Export could not be completed. Try again later.",
        uploadId: cleaned ? null : (multipart?.uploadId ?? prior.uploadId),
        objectKey: cleaned ? null : (objectKey ?? prior.objectKey),
        leaseUntil: null,
        attemptId: null,
      })
      .where(
        and(
          eq(t.id, input.requestId),
          eq(t.attemptId, attempt),
          sql`${t.status} IN ('building','ready')`
        )
      );
    throw error;
  }
}
