import { and, eq, inArray, isNull, lte, or } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { workspaceSubscription } from "./billing.schema";
import { PAST_DUE_GRACE_DAYS, PLANS, trialOutcome } from "./domain";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Subscriptions handled per run; the next run picks up the rest. */
const BATCH = 200;

/**
 * Daily cron: moves every subscription whose trial ended, whose past-due grace ran out or
 * whose canceled period ended to its plan's fallback, active, and records
 * `billing.plan_lapsed` for each. Each update is conditional on the state it read, so a
 * webhook arriving meanwhile wins, and a second run finds nothing to do (idempotent).
 */
export async function expireTrials(deps: {
  readonly db: Database;
  readonly clock: Clock;
  readonly ids: Ids;
  readonly requestContext: RequestContext;
}): Promise<{ readonly expired: number }> {
  const now = deps.clock.now();
  const graceStart = new Date(now.getTime() - PAST_DUE_GRACE_DAYS * DAY_MS);
  const s = workspaceSubscription;
  // Only rows trialOutcome lapses, so rows it keeps (a plan that is its own fallback, a
  // plan removed from the catalog) never fill the batch and starve the others.
  const lapsing = PLANS.filter((plan) => plan.fallbackPlanId !== plan.id).map(
    (plan) => plan.id
  );
  const known = PLANS.map((plan) => plan.id);

  const candidates = await deps.db
    .select()
    .from(s)
    .where(
      or(
        and(
          eq(s.status, "trialing"),
          inArray(s.planId, lapsing),
          lte(s.trialEndsAt, now)
        ),
        and(
          eq(s.status, "past_due"),
          inArray(s.planId, lapsing),
          lte(s.periodEnd, graceStart)
        ),
        and(
          eq(s.status, "canceled"),
          inArray(s.planId, known),
          or(isNull(s.periodEnd), lte(s.periodEnd, now))
        )
      )
    )
    .limit(BATCH);

  const lapses = candidates.flatMap((sub) => {
    const outcome = trialOutcome(sub, now);
    return outcome.action === "expire" ? [{ sub, outcome }] : [];
  });
  if (lapses.length === 0) return { expired: 0 };

  const results = await deps.db.batch(
    lapses.map(({ sub, outcome }) =>
      deps.db
        .update(s)
        .set({
          planId: outcome.toPlanId,
          status: "active",
          providerSubscriptionId:
            sub.status === "canceled" ? null : sub.providerSubscriptionId,
          updatedAt: now,
        })
        .where(
          and(
            eq(s.workspaceId, sub.workspaceId),
            eq(s.planId, sub.planId),
            eq(s.status, sub.status),
            eq(s.updatedAt, sub.updatedAt)
          )
        )
        .returning({ workspaceId: s.workspaceId })
    ) as [never, ...never[]]
  );

  let expired = 0;
  for (const [index, { sub, outcome }] of lapses.entries()) {
    if ((results[index] as unknown[]).length === 0) continue;
    expired += 1;
    await recordAuditEvent(deps, deps.requestContext, {
      action: "billing.plan_lapsed",
      actor: { kind: "system" },
      workspaceId: sub.workspaceId,
      target: { type: "workspace", id: sub.workspaceId },
      metadata: {
        previousPlanId: sub.planId,
        planId: outcome.toPlanId,
        reason: outcome.reason,
      },
    });
  }
  return { expired };
}
