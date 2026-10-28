import { eq } from "drizzle-orm";

import type { Database } from "../database";
import type { Clock } from "../kernel";
import {
  entitlementOverride,
  workspaceAddon,
  workspaceSubscription,
} from "./billing.schema";
import {
  type AddonGrant,
  type BillingSettings,
  DEFAULT_PLAN_ID,
  type Entitlements,
  entitlements,
  findPlan,
  type Override,
  type SubscriptionStatus,
  trialOutcome,
  UNLIMITED_PLAN,
} from "./domain";

export interface ResolvedBilling {
  readonly mode: BillingSettings["mode"];
  /** The plan in effect (after a lapsed trial or subscription, its fallback). */
  readonly planId: string;
  /** null: no subscription row (default plan) or billing off. */
  readonly status: SubscriptionStatus | null;
  readonly trialEndsAt: Date | null;
  readonly periodEnd: Date | null;
  readonly provider: string | null;
  readonly providerCustomerId: string | null;
  readonly addons: readonly AddonGrant[];
  readonly overrides: readonly Override[];
  readonly entitlements: Entitlements;
}

/**
 * What a workspace may use now: its subscription's plan (the default plan without one),
 * its add-ons and overrides, merged by the pure `entitlements` rule. A trial or
 * subscription that has lapsed counts as its fallback plan even before the daily
 * expireTrials run. BILLING=off short-circuits to the unlimited plan without a query.
 */
export async function resolveEntitlements(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly settings: BillingSettings;
  },
  workspaceId: string
): Promise<ResolvedBilling> {
  if (deps.settings.mode === "off") {
    return {
      mode: "off",
      planId: UNLIMITED_PLAN.id,
      status: null,
      trialEndsAt: null,
      periodEnd: null,
      provider: null,
      providerCustomerId: null,
      addons: [],
      overrides: [],
      entitlements: entitlements(UNLIMITED_PLAN, [], []),
    };
  }

  const [subscriptions, addons, overrideRows] = await deps.db.batch([
    deps.db
      .select()
      .from(workspaceSubscription)
      .where(eq(workspaceSubscription.workspaceId, workspaceId))
      .limit(1),
    deps.db
      .select({
        addonId: workspaceAddon.addonId,
        quantity: workspaceAddon.quantity,
      })
      .from(workspaceAddon)
      .where(eq(workspaceAddon.workspaceId, workspaceId)),
    deps.db
      .select({
        key: entitlementOverride.key,
        kind: entitlementOverride.kind,
        enabled: entitlementOverride.enabled,
        limit: entitlementOverride.limit,
      })
      .from(entitlementOverride)
      .where(eq(entitlementOverride.workspaceId, workspaceId)),
  ]);
  const subscription = subscriptions[0] ?? null;

  let planId = subscription?.planId ?? DEFAULT_PLAN_ID;
  let status = subscription?.status ?? null;
  if (subscription) {
    const outcome = trialOutcome(subscription, deps.clock.now());
    if (outcome.action === "expire") {
      // As expireTrials will write it: the fallback plan, active.
      planId = outcome.toPlanId;
      status = "active";
    }
  }
  // A plan removed from the catalog counts as the default plan.
  const plan = findPlan(planId) ?? findPlan(DEFAULT_PLAN_ID) ?? UNLIMITED_PLAN;

  const overrides: Override[] = overrideRows.map((row) =>
    row.kind === "feature"
      ? { key: row.key, kind: "feature", enabled: row.enabled === true }
      : { key: row.key, kind: "limit", limit: row.limit }
  );

  return {
    mode: deps.settings.mode,
    planId: plan.id,
    status,
    trialEndsAt: subscription?.trialEndsAt ?? null,
    periodEnd: subscription?.periodEnd ?? null,
    provider: subscription?.provider ?? null,
    providerCustomerId: subscription?.providerCustomerId ?? null,
    addons,
    overrides,
    entitlements: entitlements(plan, addons, overrides),
  };
}
