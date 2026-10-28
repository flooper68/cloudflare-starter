import type { Database } from "../database";
import type { Clock, Ids } from "../kernel";
import { createFileRecord } from "./create-file-record";
import { PresignedUrlsUnavailableError, type UploadInput } from "./domain";
import { presignR2Url, type R2Config } from "./r2-presign";

/** Presigned path: records the file and returns a PUT URL the browser uploads to directly. */
export async function createPresignedUpload(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly r2: R2Config | null;
  },
  input: UploadInput & { readonly ownerUserId: string }
): Promise<{
  readonly fileId: string;
  readonly r2Key: string;
  readonly uploadUrl: string;
}> {
  const r2 = deps.r2;
  if (!r2)
    throw new PresignedUrlsUnavailableError(
      "R2 presigned URLs are not configured"
    );

  const file = await createFileRecord(deps, input);
  const uploadUrl = await presignR2Url(r2, file.r2Key, {
    method: "PUT",
    headers: {
      "Content-Type": input.mimeType,
      "Content-Length": String(input.sizeBytes),
    },
  });
  return { fileId: file.fileId, r2Key: file.r2Key, uploadUrl };
}
