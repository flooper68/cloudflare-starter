import { desc, eq } from "drizzle-orm";

import type { Database } from "../database";
import { files } from "./files.schema";

export interface FileSummary {
  readonly id: string;
  readonly filename: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly createdAt: string;
}

/** The user's files, newest first. */
export async function listOwnedFiles(
  deps: { readonly db: Database },
  input: { readonly ownerUserId: string; readonly limit?: number }
): Promise<readonly FileSummary[]> {
  const rows = await deps.db.query.files.findMany({
    where: eq(files.ownerUserId, input.ownerUserId),
    orderBy: desc(files.createdAt),
    limit: input.limit ?? 50,
  });
  return rows.map((file) => ({
    id: file.id,
    filename: file.filename,
    contentType: file.contentType,
    sizeBytes: file.sizeBytes,
    createdAt: file.createdAt.toISOString(),
  }));
}
