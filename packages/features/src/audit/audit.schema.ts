import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { RequestSource } from "../kernel";

import {
  AUDIT_ACTOR_KINDS,
  AUDIT_OUTCOMES,
  type AuditAction,
  type AuditTargetType,
} from "./domain";

/**
 * Append-only audit log. Only recordAuditEvent inserts and only purgeAuditEvents deletes
 * (test/architecture/audit-coverage.test.ts). No foreign keys on purpose: events outlive
 * the users and workspaces they mention.
 */
export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
    action: text("action").$type<AuditAction>().notNull(),
    outcome: text("outcome", { enum: AUDIT_OUTCOMES }).notNull(),
    actorUserId: text("actor_user_id"),
    actorKind: text("actor_kind", { enum: AUDIT_ACTOR_KINDS }).notNull(),
    impersonatorUserId: text("impersonator_user_id"),
    targetType: text("target_type").$type<AuditTargetType>().notNull(),
    targetId: text("target_id").notNull(),
    workspaceId: text("workspace_id"),
    traceId: text("trace_id").notNull(),
    source: text("source").$type<RequestSource>().notNull(),
    ip: text("ip"),
    metadata: text("metadata", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
  },
  (table) => [
    index("audit_events_occurred_at_idx").on(table.occurredAt),
    index("audit_events_actor_idx").on(table.actorUserId, table.occurredAt),
    index("audit_events_target_idx").on(table.targetType, table.targetId),
    index("audit_events_workspace_idx").on(table.workspaceId, table.occurredAt),
  ]
);
