import { asc, like } from "drizzle-orm";

import { user } from "../accounts";
import type { AdminAuthGateway } from "../admin";
import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import {
  type Clock,
  DomainError,
  type Ids,
  type RequestContext,
} from "../kernel";
import { prepareUserErasure } from "../privacy";
import {
  isQaRunAddress,
  QA_CLEANUP_BATCH,
  QA_LEFTOVER_MIN_AGE_MS,
} from "./domain";

/**
 * Erases QA run accounts (`qa+<runId>-<role>@<domain>`, never the QA admin, never any
 * other address) through the real erasure: the same preparation, auth deletion and
 * completion hooks as a person's own account deletion, recorded as `user.deleted` with the
 * system as actor. With `runId`, that run's accounts of any age; without, every run
 * account older than two hours (the nightly cleanup of aborted runs). At most
 * QA_CLEANUP_BATCH per call. An account that is the last manager of a workspace another
 * account of the batch still uses is retried after the others; what still cannot go is
 * returned in `remaining`.
 */
export async function eraseQaAccounts(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly gateway: AdminAuthGateway;
    readonly eraseUserArtifacts: (input: {
      userId: string;
      email: string;
    }) => Promise<void>;
    readonly eraseWorkspaceArtifacts: (
      ids: readonly string[],
      userId: string
    ) => Promise<void>;
  },
  input: { readonly domain: string; readonly runId: string | null }
): Promise<{
  readonly erased: readonly string[];
  readonly remaining: readonly string[];
}> {
  if (input.runId !== null && !/^\d{8}[a-z]{4}$/.test(input.runId)) {
    throw new DomainError(
      "invalid_input",
      "runId must be <yyyymmdd><4 lowercase letters>",
      "INVALID_RUN_ID"
    );
  }
  const domain = input.domain.toLowerCase();
  const prefix = input.runId ? `qa+${input.runId}-` : "qa+";
  const cutoff = deps.clock.now().getTime() - QA_LEFTOVER_MIN_AGE_MS;
  const rows = await deps.db
    .select({ id: user.id, email: user.email, createdAt: user.createdAt })
    .from(user)
    .where(like(user.email, `${prefix}%@${domain}`))
    .orderBy(asc(user.createdAt))
    .limit(QA_CLEANUP_BATCH * 4);
  let pending = rows
    .filter(
      (row) =>
        isQaRunAddress(row.email, domain) &&
        row.email.toLowerCase().startsWith(prefix) &&
        (input.runId !== null || row.createdAt.getTime() <= cutoff)
    )
    .slice(0, QA_CLEANUP_BATCH);
  const erased: string[] = [];
  for (let pass = 0; pass < 3 && pending.length > 0; pass++) {
    const blocked: typeof pending = [];
    for (const row of pending) {
      const operationId = deps.ids.uuid();
      try {
        await prepareUserErasure(deps, {
          userId: row.id,
          operationId,
          actor: { kind: "system", userId: null },
        });
      } catch (error) {
        if (error instanceof DomainError && error.kind === "conflict") {
          blocked.push(row);
          continue;
        }
        throw error;
      }
      await deps.gateway.deleteUser(row.id, operationId);
      await recordAuditEvent(deps, deps.requestContext, {
        action: "user.deleted",
        actor: { kind: "system", userId: null },
        target: { type: "user", id: row.id },
      });
      erased.push(row.email);
    }
    if (blocked.length === pending.length) {
      pending = blocked;
      break;
    }
    pending = blocked;
  }
  return { erased, remaining: pending.map((row) => row.email) };
}
