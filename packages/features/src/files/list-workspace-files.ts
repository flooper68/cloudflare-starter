import { desc } from "drizzle-orm";

import type { Database } from "../database";
import { liveIn } from "../trash";
import { type Actor, requirePermission } from "../workspaces";
import { files } from "./files.schema";

export interface FileSummary {
  readonly id: string;
  readonly filename: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly createdAt: string;
}

/** The live files of the actor's workspace (not those in its trash), newest first. */
export async function listWorkspaceFiles(
  deps: { readonly db: Database },
  actor: Actor,
  input: { readonly limit?: number }
): Promise<readonly FileSummary[]> {
  requirePermission(actor, "files.read");
  const rows = await deps.db.query.files.findMany({
    where: liveIn(files, actor),
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
