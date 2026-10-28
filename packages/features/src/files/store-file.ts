import { eq } from "drizzle-orm";

import type { Database } from "../database";
import type { Clock, Ids } from "../kernel";
import { type CreatedFile, createFileRecord } from "./create-file-record";
import type { UploadInput } from "./domain";
import { files } from "./files.schema";

/**
 * Binding path: stores the bytes through the Worker in `FILES` and records the file.
 * If the upload fails the record is removed, so the table and the bucket stay in step.
 */
export async function storeFile(
  deps: {
    readonly db: Database;
    readonly bucket: R2Bucket;
    readonly clock: Clock;
    readonly ids: Ids;
  },
  input: UploadInput & {
    readonly ownerUserId: string;
    readonly body: ArrayBuffer;
  }
): Promise<CreatedFile> {
  const file = await createFileRecord(deps, input);

  try {
    await deps.bucket.put(file.r2Key, input.body, {
      httpMetadata: { contentType: input.mimeType },
    });
  } catch (error) {
    await deps.db.delete(files).where(eq(files.id, file.fileId));
    throw error;
  }

  return file;
}
