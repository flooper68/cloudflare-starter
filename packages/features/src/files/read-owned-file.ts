import type { Database } from "../database";
import { FileNotFoundError } from "./domain";
import { findOwnedFile, type OwnedFile } from "./find-owned-file";

/** Binding path: the user's file and its object from `FILES`; throws FileNotFoundError. */
export async function readOwnedFile(
  deps: { readonly db: Database; readonly bucket: R2Bucket },
  input: { readonly fileId: string; readonly ownerUserId: string }
): Promise<{ readonly file: OwnedFile; readonly object: R2ObjectBody }> {
  const file = await findOwnedFile(deps, input);
  const object = await deps.bucket.get(file.r2Key);
  if (!object) throw new FileNotFoundError();
  return { file, object };
}
