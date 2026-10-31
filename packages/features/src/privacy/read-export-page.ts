import { type SQL, sql } from "drizzle-orm";
import type { Database } from "../database";
import {
  type DataEntity,
  EXPORT_PAGE_SIZE,
  type ExportSubject,
} from "./domain";
/** SQL identifiers come exclusively from the code-owned catalog; values are always bound. */
export async function readExportPage(
  deps: { readonly db: Database },
  entity: DataEntity,
  subject: ExportSubject,
  cursor: number
) {
  if (entity.columns.length === 0) return [];
  const identifier = (value: string) => {
    if (!/^[a-z][a-z0-9_]*$/.test(value))
      throw new Error("Invalid catalog identifier");
    return sql.raw(`"${value}"`);
  };
  if (entity.optional) {
    const tables = await deps.db.all(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${entity.table}`
    );
    if (!tables.length) return [];
  }
  const personal = sql`SELECT w.id FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id WHERE w.kind='personal' AND m.user_id=${subject.userId}`;
  let predicate: SQL;
  if (subject.scope === "workspace") {
    if (!entity.workspaceColumn) return [];
    predicate = sql`${identifier(entity.workspaceColumn)}=${subject.workspaceId}`;
  } else if (entity.userMode === "audit")
    predicate = sql`actor_user_id=${subject.userId} OR (target_type='user' AND target_id=${subject.userId})`;
  else if (entity.userMode === "invitations")
    predicate = sql`invited_by=${subject.userId} OR email=(SELECT email FROM user WHERE id=${subject.userId})`;
  else if (entity.userMode === "own-files")
    predicate = sql`created_by=${subject.userId} OR workspace_id IN (${personal})`;
  else if (entity.userColumn)
    predicate = sql`${identifier(entity.userColumn)}=${subject.userId}`;
  else if (entity.workspaceColumn && entity.userMode === "personal-workspaces")
    predicate = sql`${identifier(entity.workspaceColumn)} IN (${personal})`;
  else return [];
  return deps.db.all<Record<string, unknown> & { _rowid: number }>(
    sql`SELECT rowid AS _rowid, ${sql.join(entity.columns.map(identifier), sql`, `)} FROM ${identifier(entity.table)} WHERE (${predicate}) AND rowid>${cursor} ORDER BY rowid LIMIT ${EXPORT_PAGE_SIZE}`
  );
}
