import { and, eq } from "drizzle-orm";

import type { Database } from "../database";
import { liveIn } from "../trash";
import { type Actor, requirePermission } from "../workspaces";
import { FileNotFoundError } from "./domain";
import { files } from "./files.schema";

export type WorkspaceFile = typeof files.$inferSelect;

/** A file of the actor's workspace by id; FileNotFoundError when missing, elsewhere or in the trash. */
export async function findWorkspaceFile(
  deps: { readonly db: Database },
  actor: Actor,
  input: { readonly fileId: string }
): Promise<WorkspaceFile> {
  requirePermission(actor, "files.read");
  const file = await deps.db.query.files.findFirst({
    where: and(eq(files.id, input.fileId), liveIn(files, actor)),
  });
  if (!file) throw new FileNotFoundError();
  return file;
}
