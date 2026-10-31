import { and, eq } from "drizzle-orm";

import type { Database } from "../database";
import { enqueueJob } from "../jobs";
import {
  type BillingGate,
  type Clock,
  DomainError,
  type Ids,
  type RequestContext,
} from "../kernel";
import type { JobQueue, ProductAnalytics } from "../platform";
import { trackEvent } from "../product-analytics";
import type { Actor } from "../workspaces";
import { cleanupStorage } from "./cleanup-storage";
import { type CreatedFile, createFileRecord } from "./create-file-record";
import {
  cleanupStorageJob,
  contentCategory,
  fileUploadedEvent,
  type UploadInput,
} from "./domain";
import { files } from "./files.schema";
import { rememberUploadCleanup } from "./remember-upload-cleanup";

/**
 * Binding path: stores the bytes through the Worker in `FILES` and records the file in
 * the actor's workspace. If the upload fails the record is removed, so the table and the
 * bucket stay in step. A stored file is tracked as `files.uploaded`.
 */
export async function storeFile(
  deps: {
    readonly db: Database;
    readonly bucket: R2Bucket;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly analytics: ProductAnalytics;
    readonly billing: BillingGate;
    readonly jobQueue: JobQueue;
  },
  actor: Actor,
  input: UploadInput & { readonly body: ArrayBuffer }
): Promise<CreatedFile> {
  const file = await createFileRecord(deps, actor, input);

  try {
    await deps.bucket.put(file.r2Key, input.body, {
      httpMetadata: { contentType: input.mimeType },
    });
  } catch (error) {
    await deps.db.delete(files).where(eq(files.id, file.fileId));
    throw error;
  }

  // Erasure may have removed the row while R2 was writing. Trash is still a valid reference.
  const [reference] = await deps.db
    .select({ id: files.id })
    .from(files)
    .where(and(eq(files.id, file.fileId), eq(files.r2Key, file.r2Key)));
  if (!reference) {
    await rememberUploadCleanup(deps, {
      r2Key: file.r2Key,
      workspaceId: actor.workspaceId,
    });
    try {
      await cleanupStorage(deps, { target: file.r2Key });
    } catch (cleanupError) {
      try {
        await enqueueJob(
          deps,
          cleanupStorageJob,
          { target: file.r2Key },
          { context: { ...deps.requestContext, ip: null } }
        );
      } catch (queueError) {
        throw new AggregateError(
          [cleanupError, queueError],
          "Upload was erased; durable cleanup awaits retry"
        );
      }
      throw cleanupError;
    }
    throw new DomainError(
      "not_found",
      "The file was deleted while its upload was finishing",
      "UPLOAD_ERASED"
    );
  }

  trackEvent(
    deps,
    {
      ...deps.requestContext,
      userId: actor.userId,
      workspaceId: actor.workspaceId,
    },
    fileUploadedEvent,
    {
      content_category: contentCategory(input.mimeType),
      size_bytes: input.sizeBytes,
    }
  );
  return file;
}
