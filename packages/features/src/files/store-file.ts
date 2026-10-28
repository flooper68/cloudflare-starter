import { eq } from "drizzle-orm";

import type { Database } from "../database";
import type { BillingGate, Clock, Ids, RequestContext } from "../kernel";
import type { ProductAnalytics } from "../platform";
import { trackEvent } from "../product-analytics";
import type { Actor } from "../workspaces";
import { type CreatedFile, createFileRecord } from "./create-file-record";
import { contentCategory, fileUploadedEvent, type UploadInput } from "./domain";
import { files } from "./files.schema";

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
