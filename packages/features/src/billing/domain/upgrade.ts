import {
  ADDONS,
  type FeatureKey,
  type MetricKey,
  PLANS,
  type Plan,
} from "./catalog";

/** What would lift a refusal: plans to switch to and add-ons to buy, in catalog order. */
export interface UpgradeOptions {
  readonly planIds: readonly string[];
  readonly addonIds: readonly string[];
}

/** What the workspace needs: a feature, or room for `needed` of a metric. */
export type Need =
  | { readonly feature: FeatureKey }
  | { readonly metric: MetricKey; readonly needed: number };

/**
 * The customer-facing plans other than `currentPlanId` that cover `need` and are an
 * upgrade (for a metric: a higher limit than the current plan's own, so an override that
 * lowered the limit never suggests a smaller plan), and the add-ons that grant the feature
 * or raise the metric's limit (whether one unit is enough or not).
 */
export function upgradeOptions(
  currentPlanId: string,
  need: Need,
  plans: readonly Plan[] = PLANS,
  addons = ADDONS
): UpgradeOptions {
  const current = plans.find((plan) => plan.id === currentPlanId);
  const covers = (plan: Plan) => {
    if ("feature" in need) return plan.features.includes(need.feature);
    const limit = plan.limits[need.metric];
    const own = current?.limits[need.metric];
    if (own === null) return false;
    const higher = limit === null || own === undefined || limit > own;
    return higher && (limit === null || limit >= need.needed);
  };
  return {
    planIds: plans
      .filter((plan) => !plan.internal && plan.id !== currentPlanId)
      .filter(covers)
      .map((plan) => plan.id),
    addonIds: addons
      .filter((addon) =>
        "feature" in need
          ? (addon.features ?? []).includes(need.feature)
          : (addon.limits?.[need.metric] ?? 0) > 0
      )
      .map((addon) => addon.id),
  };
}
