import type { Database } from "../database";
import type { BillingGate, Clock, Ids } from "../kernel";
import { type Actor, requirePermission } from "../workspaces";
import { createFileRecord } from "./create-file-record";
import { PresignedUrlsUnavailableError, type UploadInput } from "./domain";
import { presignR2Url, type R2Config } from "./r2-presign";

/**
 * Presigned path: records the file and returns a PUT URL the browser uploads to directly.
 * A gated feature (`files.presigned_upload`): checked after the permission, before the
 * storage limits createFileRecord checks.
 */
export async function createPresignedUpload(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly r2: R2Config | null;
    readonly billing: BillingGate;
  },
  actor: Actor,
  input: UploadInput
): Promise<{
  readonly fileId: string;
  readonly r2Key: string;
  readonly uploadUrl: string;
}> {
  requirePermission(actor, "files.write");
  await deps.billing.requireFeature(
    actor.workspaceId,
    "files.presigned_upload"
  );
  const r2 = deps.r2;
  if (!r2)
    throw new PresignedUrlsUnavailableError(
      "R2 presigned URLs are not configured"
    );

  const file = await createFileRecord(deps, actor, input);
  const uploadUrl = await presignR2Url(r2, file.r2Key, {
    method: "PUT",
    headers: {
      "Content-Type": input.mimeType,
      "Content-Length": String(input.sizeBytes),
    },
  });
  return { fileId: file.fileId, r2Key: file.r2Key, uploadUrl };
}
