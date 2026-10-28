import type { Database } from "../database";
import type { Clock } from "../kernel";
import { type BillingSettings, isFeatureKey, requireIncluded } from "./domain";
import { resolveEntitlements } from "./resolve-entitlements";

/**
 * Throws FeatureNotIncludedError (`limit_reached`, with upgrade options) unless the
 * workspace's entitlements include `feature`. The caller has checked the actor's
 * permission first. An unknown key is a programming error.
 */
export async function assertFeature(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly settings: BillingSettings;
  },
  workspaceId: string,
  feature: string
): Promise<void> {
  if (!isFeatureKey(feature))
    throw new Error(`Unknown billing feature ${feature}: add it to FEATURES`);
  if (deps.settings.mode === "off") return;
  const resolved = await resolveEntitlements(deps, workspaceId);
  requireIncluded(resolved.entitlements, feature);
}
