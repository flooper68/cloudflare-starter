import { desc, eq, sql } from "drizzle-orm";

import type { Database } from "../database";
import { isRole, type Role } from "./domain";
import { workspaceMembers, workspaces } from "./workspaces.schema";

export interface WorkspaceSummary {
  readonly id: string;
  readonly name: string;
  readonly kind: "personal" | "shared";
  readonly role: Role;
}

/** The user's workspaces, the default (most recently active) first. */
export async function listWorkspaces(
  deps: { readonly db: Database },
  input: { readonly userId: string }
): Promise<{
  readonly activeWorkspaceId: string | null;
  readonly items: readonly WorkspaceSummary[];
}> {
  const rows = await deps.db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      kind: workspaces.kind,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, input.userId))
    .orderBy(
      sql`${workspaceMembers.lastActiveAt} desc nulls last`,
      desc(workspaceMembers.createdAt)
    );

  const items = rows.flatMap((row) =>
    isRole(row.role) ? [{ ...row, role: row.role }] : []
  );
  return { activeWorkspaceId: items[0]?.id ?? null, items };
}
