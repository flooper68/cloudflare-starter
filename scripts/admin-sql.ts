/**
 * The SQL of `setup:admin`, as pure functions: the account lookup and the role change with
 * its audit events. Tested in admin-sql.test.ts; `--dry-run` prints them without running.
 */

/** A SQL string literal (callers pass validated addresses and generated ids). */
export const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

export function lookupSql(email: string): string {
  return `SELECT id, role, banned FROM user WHERE lower(email) = ${literal(email)}`;
}

export interface RoleChange {
  /** The account id, or a SQL expression yielding it (the dry run's subquery). */
  readonly userId: { readonly literal: string } | { readonly sql: string };
  readonly role: "admin" | "user";
  readonly previousRole: "admin" | "user";
  readonly unban: boolean;
  readonly now: number;
  readonly traceId: string;
  /** Ids of the audit rows, in order (role change, then unban). */
  readonly auditIds: readonly string[];
}

/** The account id as SQL. */
function idSql(userId: RoleChange["userId"]): string {
  return "literal" in userId ? literal(userId.literal) : `(${userId.sql})`;
}

/** The id of the account with this address, as a subquery (for the dry run). */
export function userIdSubquery(email: string): string {
  return `SELECT id FROM user WHERE lower(email) = ${literal(email)}`;
}

/**
 * One statement batch: the role (and suspension) change and its audit events, as
 * recordAuditEvent writes them (packages/features/src/audit), actor system, source script.
 */
export function roleChangeSql(change: RoleChange): string {
  const id = idSql(change.userId);
  const auditIds = [...change.auditIds];
  const auditRow = (action: string, metadata: Record<string, unknown>) =>
    [
      "INSERT INTO audit_events (id, occurred_at, action, outcome, actor_user_id, actor_kind, impersonator_user_id, target_type, target_id, workspace_id, trace_id, source, ip, metadata)",
      `VALUES (${literal(auditIds.shift() ?? "")}, ${change.now}, ${literal(action)}, 'success', NULL, 'system', NULL, 'user', ${id}, NULL, ${literal(change.traceId)}, 'script', NULL, ${literal(JSON.stringify(metadata))});`,
    ].join(" ");
  return [
    `UPDATE user SET role = ${literal(change.role)},${change.unban ? " banned = 0, ban_reason = NULL, ban_expires = NULL," : ""} updated_at = ${change.now} WHERE id = ${id};`,
    change.previousRole === change.role
      ? ""
      : auditRow("user.role_changed", {
          previousRole: change.previousRole,
          role: change.role,
        }),
    change.unban ? auditRow("user.unbanned", {}) : "",
  ]
    .filter(Boolean)
    .join(" ");
}
