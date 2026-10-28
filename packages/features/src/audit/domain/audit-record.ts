import type { RequestSource } from "../../kernel";
import type {
  AuditAction,
  AuditActorKind,
  AuditOutcome,
  AuditTargetType,
} from "./audit-event";

/** One stored audit event, as readers (the admin portal, an export) see it. */
export interface AuditEvent {
  readonly id: string;
  /** ISO 8601, UTC. */
  readonly occurredAt: string;
  readonly action: AuditAction;
  readonly outcome: AuditOutcome;
  readonly actor: {
    readonly kind: AuditActorKind;
    readonly userId: string | null;
    readonly impersonatorUserId: string | null;
  };
  readonly target: { readonly type: AuditTargetType; readonly id: string };
  readonly workspaceId: string | null;
  /** The W3C trace id of the request, queue message or cron run that caused it. */
  readonly traceId: string;
  readonly source: RequestSource;
  readonly ip: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/** The columns of an `audit_events` row, as Drizzle returns them. */
export interface AuditEventRow {
  readonly id: string;
  readonly occurredAt: Date;
  readonly action: AuditAction;
  readonly outcome: AuditOutcome;
  readonly actorUserId: string | null;
  readonly actorKind: AuditActorKind;
  readonly impersonatorUserId: string | null;
  readonly targetType: AuditTargetType;
  readonly targetId: string;
  readonly workspaceId: string | null;
  readonly traceId: string;
  readonly source: RequestSource;
  readonly ip: string | null;
  readonly metadata: Record<string, unknown>;
}

/** The read model of a stored row. */
export function toAuditEvent(row: AuditEventRow): AuditEvent {
  return {
    id: row.id,
    occurredAt: row.occurredAt.toISOString(),
    action: row.action,
    outcome: row.outcome,
    actor: {
      kind: row.actorKind,
      userId: row.actorUserId,
      impersonatorUserId: row.impersonatorUserId,
    },
    target: { type: row.targetType, id: row.targetId },
    workspaceId: row.workspaceId,
    traceId: row.traceId,
    source: row.source,
    ip: row.ip,
    metadata: row.metadata,
  };
}
