import { findPlan, PAST_DUE_GRACE_DAYS, type Plan } from "./catalog";
import type { SubscriptionStatus } from "./subscription";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The parts of a workspace's subscription that decide whether its plan still holds. */
export interface SubscriptionState {
  readonly planId: string;
  readonly status: SubscriptionStatus;
  readonly trialEndsAt: Date | null;
  readonly periodEnd: Date | null;
}

export type LapseReason =
  | "trial_ended"
  | "past_due_grace_ended"
  | "period_ended";

export type TrialOutcome =
  | { readonly action: "keep" }
  | {
      readonly action: "expire";
      readonly toPlanId: string;
      readonly reason: LapseReason;
    };

/**
 * Whether a subscription keeps its plan at `now` or lapses to the plan's fallback:
 * - trialing: until `trialEndsAt`;
 * - past_due: a grace of PAST_DUE_GRACE_DAYS after `periodEnd` (kept while unknown);
 * - canceled: until `periodEnd` (lapses at once without one);
 * - active: kept.
 * A plan that is its own fallback only lapses from canceled (back to active). An unknown
 * plan (removed from the catalog) is kept; resolveEntitlements treats it as the default.
 */
export function trialOutcome(sub: SubscriptionState, now: Date): TrialOutcome {
  const fallback = findPlan(sub.planId)?.fallbackPlanId;
  if (!fallback || (fallback === sub.planId && sub.status !== "canceled"))
    return { action: "keep" };
  const at = now.getTime();
  const expire = (reason: LapseReason): TrialOutcome => ({
    action: "expire",
    toPlanId: fallback,
    reason,
  });

  switch (sub.status) {
    case "trialing":
      return sub.trialEndsAt && sub.trialEndsAt.getTime() <= at
        ? expire("trial_ended")
        : { action: "keep" };
    case "past_due":
      return sub.periodEnd &&
        sub.periodEnd.getTime() + PAST_DUE_GRACE_DAYS * DAY_MS <= at
        ? expire("past_due_grace_ended")
        : { action: "keep" };
    case "canceled":
      return !sub.periodEnd || sub.periodEnd.getTime() <= at
        ? expire("period_ended")
        : { action: "keep" };
    case "active":
      return { action: "keep" };
  }
}

/** When a trial of `plan` started at `now` ends, or null when the plan has no trial. */
export function trialEndsAt(plan: Plan, now: Date): Date | null {
  return plan.trialDays
    ? new Date(now.getTime() + plan.trialDays * DAY_MS)
    : null;
}
