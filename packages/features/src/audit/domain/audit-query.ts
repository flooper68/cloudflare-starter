import { z } from "zod";

import {
  AUDIT_ACTIONS,
  AUDIT_TARGET_TYPES,
  type AuditAction,
} from "./audit-event";
import { InvalidAuditInputError } from "./errors";

export const AUDIT_PAGE_SIZE_DEFAULT = 50;
export const AUDIT_PAGE_SIZE_MAX = 200;

/**
 * Filters and page of an audit log query; the input schema of listAuditEvents and of any
 * procedure that exposes it. Time range: `from` inclusive, `to` exclusive (ISO 8601).
 */
export const auditQuerySchema = z
  .object({
    actorUserId: z.string().min(1).optional(),
    action: z.enum(AUDIT_ACTIONS as [AuditAction, ...AuditAction[]]).optional(),
    targetType: z.enum(AUDIT_TARGET_TYPES).optional(),
    targetId: z.string().min(1).optional(),
    workspaceId: z.string().min(1).optional(),
    from: z.iso.datetime().optional(),
    to: z.iso.datetime().optional(),
    /** `nextCursor` of the previous page. */
    cursor: z.string().min(1).optional(),
    limit: z
      .number()
      .int()
      .min(1)
      .max(AUDIT_PAGE_SIZE_MAX)
      .default(AUDIT_PAGE_SIZE_DEFAULT),
  })
  .strict()
  // The target index is (target_type, target_id): a target id alone could not use it.
  .refine((query) => !query.targetId || query.targetType, {
    message: "targetId needs targetType",
    path: ["targetType"],
  });

export type AuditQueryInput = z.input<typeof auditQuerySchema>;
export type AuditQuery = z.output<typeof auditQuerySchema>;

/** Position after the last event of a page: events are ordered by (occurredAt, id) descending. */
/**
 * Where a page ended: the last event's time and its insertion sequence (the row's position
 * in the table), which orders events recorded in the same millisecond.
 */
export interface AuditCursor {
  readonly occurredAtMs: number;
  readonly seq: number;
}

/** Opaque to clients: `<epoch ms>:<sequence>`. */
export function encodeAuditCursor(cursor: AuditCursor): string {
  return `${cursor.occurredAtMs}:${cursor.seq}`;
}

export function decodeAuditCursor(value: string): AuditCursor {
  const separator = value.indexOf(":");
  const ms = value.slice(0, separator);
  const seq = value.slice(separator + 1);
  if (separator < 1 || !/^\d+$/.test(ms) || !/^\d+$/.test(seq)) {
    throw new InvalidAuditInputError("Invalid audit log cursor");
  }
  return { occurredAtMs: Number(ms), seq: Number(seq) };
}
