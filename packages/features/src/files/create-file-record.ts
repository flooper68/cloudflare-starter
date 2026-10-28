import type { Database } from "../database";
import type { Clock, Ids } from "../kernel";
import {
  buildFileKey,
  type FileBucket,
  type UploadInput,
  uploadInputSchema,
} from "./domain";
import { files } from "./files.schema";

export interface CreatedFile {
  readonly fileId: string;
  readonly bucket: FileBucket;
  readonly r2Key: string;
}

/** Records a file the user is about to upload; the object key is derived from id and time. */
export async function createFileRecord(
  deps: { readonly db: Database; readonly clock: Clock; readonly ids: Ids },
  input: UploadInput & { readonly ownerUserId: string }
): Promise<CreatedFile> {
  const parsed = uploadInputSchema.parse(input);
  const fileId = deps.ids.uuid();
  const r2Key = buildFileKey(fileId, deps.clock.now());

  await deps.db.insert(files).values({
    id: fileId,
    bucket: "files",
    r2Key,
    filename: parsed.filename,
    contentType: parsed.mimeType,
    sizeBytes: parsed.sizeBytes,
    ownerUserId: input.ownerUserId,
  });

  return { fileId, bucket: "files", r2Key };
}
