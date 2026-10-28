import {
  type FeatureKey,
  findAddon,
  isFeatureKey,
  isMetricKey,
  type Limits,
  type MetricKey,
  type Plan,
} from "./catalog";
import { FeatureNotIncludedError, LimitReachedError } from "./errors";
import { upgradeOptions } from "./upgrade";

/** What a workspace may use: its plan's features and limits after add-ons and overrides. */
export interface Entitlements {
  readonly planId: string;
  readonly features: readonly FeatureKey[];
  /** `null` is unlimited. */
  readonly limits: Limits;
}

export interface AddonGrant {
  readonly addonId: string;
  readonly quantity: number;
}

/** An admin's exception for one workspace; it wins over the plan and add-ons. */
export type Override =
  | {
      readonly key: string;
      readonly kind: "feature";
      /** true grants the feature, false revokes it. */
      readonly enabled: boolean;
    }
  | {
      readonly key: string;
      readonly kind: "limit";
      /** `null` is unlimited. */
      readonly limit: number | null;
    };

/**
 * Merges a plan with its add-ons (each grants features and raises limits per unit of
 * quantity; an unlimited limit stays unlimited) and then the overrides (grant or revoke a
 * feature, set a limit). Unknown add-ons and keys, left after a catalog edit, are ignored.
 */
export function entitlements(
  plan: Plan,
  addons: readonly AddonGrant[],
  overrides: readonly Override[]
): Entitlements {
  const features = new Set<FeatureKey>(plan.features);
  const limits: Record<MetricKey, number | null> = { ...plan.limits };

  for (const grant of addons) {
    const addon = findAddon(grant.addonId);
    if (!addon || grant.quantity <= 0) continue;
    for (const feature of addon.features ?? []) features.add(feature);
    for (const [metric, amount] of Object.entries(addon.limits ?? {})) {
      if (!isMetricKey(metric)) continue;
      const limit = limits[metric];
      if (limit !== null)
        limits[metric] = limit + (amount ?? 0) * grant.quantity;
    }
  }

  for (const override of overrides) {
    if (override.kind === "feature" && isFeatureKey(override.key)) {
      if (override.enabled) features.add(override.key);
      else features.delete(override.key);
    }
    if (override.kind === "limit" && isMetricKey(override.key)) {
      limits[override.key] = override.limit;
    }
  }

  return {
    planId: plan.id,
    features: [...features].sort(),
    limits,
  };
}

export function hasFeature(ent: Entitlements, feature: FeatureKey): boolean {
  return ent.features.includes(feature);
}

/** Throws FeatureNotIncludedError, with upgrade options, unless the feature is included. */
export function requireIncluded(ent: Entitlements, feature: FeatureKey): void {
  if (hasFeature(ent, feature)) return;
  throw new FeatureNotIncludedError({
    feature,
    planId: ent.planId,
    upgrade: upgradeOptions(ent.planId, { feature }),
  });
}

/**
 * Throws LimitReachedError, with upgrade options, when `current + increment` would pass
 * the metric's limit. Reaching the limit exactly is allowed; unlimited always passes.
 */
export function checkLimit(
  ent: Entitlements,
  metric: MetricKey,
  current: number,
  increment: number
): void {
  const limit = ent.limits[metric];
  if (limit === null || current + increment <= limit) return;
  throw new LimitReachedError({
    metric,
    limit,
    current,
    increment,
    planId: ent.planId,
    upgrade: upgradeOptions(ent.planId, {
      metric,
      needed: current + increment,
    }),
  });
}
