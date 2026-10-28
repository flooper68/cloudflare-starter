import type { Database } from "../database";
import type { Actor } from "../workspaces";
import { FileNotFoundError } from "./domain";
import { findWorkspaceFile, type WorkspaceFile } from "./find-workspace-file";

/** Binding path: a file of the actor's workspace and its object from `FILES`. */
export async function readWorkspaceFile(
  deps: { readonly db: Database; readonly bucket: R2Bucket },
  actor: Actor,
  input: { readonly fileId: string }
): Promise<{ readonly file: WorkspaceFile; readonly object: R2ObjectBody }> {
  const file = await findWorkspaceFile(deps, actor, input);
  const object = await deps.bucket.get(file.r2Key);
  if (!object) throw new FileNotFoundError();
  return { file, object };
}
