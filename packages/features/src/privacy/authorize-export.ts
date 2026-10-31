import { and, eq } from "drizzle-orm";
import { user } from "../accounts";
import type { Database } from "../database";
import { isRole, requirePermission, workspaceMembers } from "../workspaces";
import { type ExportSubject, ExportUnavailableError } from "./domain";
import { erasureLock } from "./privacy.schema";
/** Re-read authorization at admission, publication and every download. */
export async function authorizeExport(
  deps: { readonly db: Database },
  subject: ExportSubject
): Promise<void> {
  const [owner] = await deps.db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, subject.userId));
  if (!owner) throw new ExportUnavailableError();
  const [erasing] = await deps.db
    .select({ id: erasureLock.id })
    .from(erasureLock)
    .where(eq(erasureLock.userId, subject.userId));
  if (erasing) throw new ExportUnavailableError();
  if (subject.scope === "workspace") {
    if (!subject.workspaceId) throw new ExportUnavailableError();
    const [membership] = await deps.db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, subject.workspaceId),
          eq(workspaceMembers.userId, subject.userId)
        )
      );
    if (!membership || !isRole(membership.role))
      throw new ExportUnavailableError();
    requirePermission({ role: membership.role }, "workspace.export");
  }
}
