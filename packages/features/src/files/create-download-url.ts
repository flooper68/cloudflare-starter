import type { Database } from "../database";
import type { Actor } from "../workspaces";
import { PresignedUrlsUnavailableError } from "./domain";
import { findWorkspaceFile } from "./find-workspace-file";
import { presignR2Url, type R2Config } from "./r2-presign";

/**
 * Presigned path: a GET URL (valid 1 hour) for a file of the actor's workspace. The URL
 * is signed only after `findWorkspaceFile` found the live file in that workspace, so a
 * trashed file gets no new URL; a URL issued before it was trashed stays valid for its
 * hour (R2 checks only the signature).
 */
export async function createDownloadUrl(
  deps: { readonly db: Database; readonly r2: R2Config | null },
  actor: Actor,
  input: { readonly fileId: string }
): Promise<{ readonly url: string }> {
  const r2 = deps.r2;
  if (!r2)
    throw new PresignedUrlsUnavailableError(
      "R2 presigned URLs are not configured"
    );

  const file = await findWorkspaceFile(deps, actor, input);
  return { url: await presignR2Url(r2, file.r2Key, { method: "GET" }) };
}
