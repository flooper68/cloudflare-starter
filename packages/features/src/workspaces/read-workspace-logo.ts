import { eq } from "drizzle-orm";
import type { Database } from "../database";
import { DomainError } from "../kernel";
import { type Actor, requirePermission } from "./domain";
import { workspaces } from "./workspaces.schema";

/** Members may read only their current workspace's current logo. */
export async function readWorkspaceLogo(
  deps: { readonly db: Database; readonly bucket: R2Bucket },
  actor: Actor,
  input: { readonly version: string }
) {
  requirePermission(actor, "members.read");
  const [row] = await deps.db
    .select({ key: workspaces.logoKey })
    .from(workspaces)
    .where(eq(workspaces.id, actor.workspaceId));
  if (
    !row?.key ||
    row.key !== `workspaces/${actor.workspaceId}/logo/${input.version}`
  )
    throw new DomainError("not_found", "Image not found");
  const object = await deps.bucket.get(row.key);
  if (!object) throw new DomainError("not_found", "Image not found");
  return object;
}
