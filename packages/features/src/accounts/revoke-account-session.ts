import { and, eq } from "drizzle-orm";
import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import {
  type Clock,
  DomainError,
  type Ids,
  type RequestContext,
} from "../kernel";
import { session } from "./accounts.schema";
import type { AccountAuthGateway } from "./ports";

/** Resolve an opaque session id under the current user before passing its token to auth. */
export async function revokeAccountSession(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly gateway: AccountAuthGateway;
  },
  input: { readonly userId: string; readonly sessionId: string }
) {
  const [row] = await deps.db
    .select({ token: session.token })
    .from(session)
    .where(
      and(eq(session.id, input.sessionId), eq(session.userId, input.userId))
    );
  if (!row)
    throw new DomainError(
      "not_found",
      "Session not found",
      "SESSION_NOT_FOUND"
    );
  await deps.gateway.revokeSession(row.token);
  await recordAuditEvent(deps, deps.requestContext, {
    action: "account.session_revoked",
    actor: { kind: "user", userId: input.userId },
    target: { type: "user", id: input.userId },
  });
  return { revoked: true };
}
