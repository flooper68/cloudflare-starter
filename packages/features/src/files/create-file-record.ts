import type { Database } from "../database";
import type { Clock, Ids } from "../kernel";
import { type Actor, requirePermission } from "../workspaces";
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

/** Records a file the actor is about to upload into their workspace; the key is derived. */
export async function createFileRecord(
  deps: { readonly db: Database; readonly clock: Clock; readonly ids: Ids },
  actor: Actor,
  input: UploadInput
): Promise<CreatedFile> {
  requirePermission(actor, "files.write");
  const parsed = uploadInputSchema.parse(input);
  const fileId = deps.ids.uuid();
  const r2Key = buildFileKey(actor.workspaceId, fileId, deps.clock.now());

  await deps.db.insert(files).values({
    id: fileId,
    workspaceId: actor.workspaceId,
    bucket: "files",
    r2Key,
    filename: parsed.filename,
    contentType: parsed.mimeType,
    sizeBytes: parsed.sizeBytes,
    createdBy: actor.userId,
  });

  return { fileId, bucket: "files", r2Key };
}
