import { and, desc, eq, inArray, lt, or, type SQL, sql } from "drizzle-orm";

import type { Database } from "../database";
import {
  can,
  isRole,
  type WorkspaceMode,
  WorkspaceModeError,
  workspaceMembers,
  workspaces,
} from "../workspaces";
import {
  type AdminActor,
  type AdminWorkspaceQueryInput,
  adminWorkspaceQuerySchema,
  decodeAdminCursor,
  encodeAdminCursor,
  likePattern,
  parseAdminQuery,
} from "./domain";

export interface AdminWorkspaceRow {
  readonly id: string;
  readonly name: string;
  readonly kind: "personal" | "shared";
  readonly createdAt: Date;
  readonly memberCount: number;
  /** Members whose role may manage members (owners); 0 means it needs a rescue. */
  readonly managerCount: number;
}

export interface AdminWorkspacePage {
  readonly items: readonly AdminWorkspaceRow[];
  readonly nextCursor: string | null;
}

/**
 * Every workspace of the app, newest first, with member and owner counts (a workspace
 * without a manager (owner) needs rescuing). Not offered in personal mode, where every workspace
 * belongs to one user and goes with their account.
 */
export async function listAllWorkspaces(
  deps: { readonly db: Database },
  _admin: AdminActor,
  input: AdminWorkspaceQueryInput & { readonly mode: WorkspaceMode }
): Promise<AdminWorkspacePage> {
  const { mode, ...filters } = input;
  if (mode === "personal") {
    throw new WorkspaceModeError(mode, "Administering workspaces");
  }
  const query = parseAdminQuery(adminWorkspaceQuerySchema, filters);

  const conditions: (SQL | undefined)[] = [
    query.search
      ? sql`${workspaces.name} like ${likePattern(query.search)} escape '\\'`
      : undefined,
    query.kind ? eq(workspaces.kind, query.kind) : undefined,
  ];
  if (query.cursor) {
    const cursor = decodeAdminCursor(query.cursor);
    const at = new Date(cursor.createdAtMs);
    conditions.push(
      or(
        lt(workspaces.createdAt, at),
        and(eq(workspaces.createdAt, at), lt(workspaces.id, cursor.id))
      )
    );
  }

  const rows = await deps.db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      kind: workspaces.kind,
      createdAt: workspaces.createdAt,
    })
    .from(workspaces)
    .where(and(...conditions))
    .orderBy(desc(workspaces.createdAt), desc(workspaces.id))
    .limit(query.limit + 1);
  const page = rows.slice(0, query.limit);

  const members = page.length
    ? await deps.db
        .select({
          workspaceId: workspaceMembers.workspaceId,
          role: workspaceMembers.role,
        })
        .from(workspaceMembers)
        .where(
          inArray(
            workspaceMembers.workspaceId,
            page.map((row) => row.id)
          )
        )
    : [];
  const countsOf = (workspaceId: string) => {
    const roles = members.filter((m) => m.workspaceId === workspaceId);
    return {
      memberCount: roles.length,
      managerCount: roles.filter(
        (m) => isRole(m.role) && can(m.role, "members.manage")
      ).length,
    };
  };

  const last = page.at(-1);
  return {
    items: page.map((row) => ({ ...row, ...countsOf(row.id) })),
    nextCursor:
      rows.length > query.limit && last
        ? encodeAdminCursor({
            createdAtMs: last.createdAt.getTime(),
            id: last.id,
          })
        : null,
  };
}
