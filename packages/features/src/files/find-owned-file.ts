import { and, eq } from "drizzle-orm";

import type { Database } from "../database";
import { FileNotFoundError } from "./domain";
import { files } from "./files.schema";

export type OwnedFile = typeof files.$inferSelect;

/** The user's file by id; throws FileNotFoundError when it is missing or someone else's. */
export async function findOwnedFile(
  deps: { readonly db: Database },
  input: { readonly fileId: string; readonly ownerUserId: string }
): Promise<OwnedFile> {
  const file = await deps.db.query.files.findFirst({
    where: and(
      eq(files.id, input.fileId),
      eq(files.ownerUserId, input.ownerUserId)
    ),
  });
  if (!file) throw new FileNotFoundError();
  return file;
}
