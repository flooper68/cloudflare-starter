import { z } from "zod";

import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { auditEvents } from "./audit.schema";
import {
  type AuditEvent,
  type AuditEventInput,
  auditEventSchema,
  findSecretKeys,
  InvalidAuditInputError,
  toAuditEvent,
} from "./domain";

/**
 * Appends one event to the audit log. The origin comes from the request context: its
 * trace id, source (http, queue, cron), IP, and by default its user as the actor and its
 * workspace. Throws InvalidAuditInputError for an action, target or metadata the catalog
 * does not allow, or metadata with a credential-like key.
 */
export async function recordAuditEvent(
  deps: { readonly db: Database; readonly clock: Clock; readonly ids: Ids },
  context: RequestContext,
  input: AuditEventInput
): Promise<AuditEvent> {
  const parsed = auditEventSchema.safeParse(input);
  if (!parsed.success) {
    throw new InvalidAuditInputError(
      `Invalid audit event: ${z.prettifyError(parsed.error)}`
    );
  }
  const event = parsed.data;
  const secretKeys = findSecretKeys(event.metadata);
  if (secretKeys.length > 0) {
    throw new InvalidAuditInputError(
      `Audit metadata must not carry credentials: ${secretKeys.join(", ")}`
    );
  }

  const actor = event.actor ?? {
    kind: context.userId ? ("user" as const) : ("system" as const),
    userId: context.userId,
  };
  const row = {
    id: deps.ids.uuid(),
    occurredAt: deps.clock.now(),
    action: event.action,
    outcome: event.outcome,
    actorUserId: actor.userId ?? null,
    actorKind: actor.kind,
    impersonatorUserId: actor.impersonatorUserId ?? null,
    targetType: event.target.type,
    targetId: event.target.id,
    workspaceId: event.workspaceId ?? context.workspaceId,
    traceId: context.traceId,
    source: context.source,
    ip: context.ip,
    metadata: event.metadata,
  };
  await deps.db.insert(auditEvents).values(row);
  return toAuditEvent(row);
}
