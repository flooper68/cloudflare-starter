import type { Database } from "../database";
import { PresignedUrlsUnavailableError } from "./domain";
import { findOwnedFile } from "./find-owned-file";
import { presignR2Url, type R2Config } from "./r2-presign";

/** Presigned path: a GET URL (valid 1 hour) for one of the user's files. */
export async function createDownloadUrl(
  deps: { readonly db: Database; readonly r2: R2Config | null },
  input: { readonly fileId: string; readonly ownerUserId: string }
): Promise<{ readonly url: string }> {
  const r2 = deps.r2;
  if (!r2)
    throw new PresignedUrlsUnavailableError(
      "R2 presigned URLs are not configured"
    );

  const file = await findOwnedFile(deps, input);
  return { url: await presignR2Url(r2, file.r2Key, { method: "GET" }) };
}
