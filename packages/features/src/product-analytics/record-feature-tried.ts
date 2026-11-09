import type { AnalyticsContext } from "../platform";
import { featureTriedEvent, type TriedFeature } from "./domain";
import { type MilestoneDeps, reachMilestoneOnce } from "./reach-milestone";
import { trackEvent } from "./track-event";

/**
 * The person used a feature (one of the FEATURE_TRIAL_* triggers): sends
 * `app.feature_tried` the first time only, true when it did. Never throws.
 */
export async function recordFeatureTried(
  deps: MilestoneDeps,
  context: AnalyticsContext & { readonly userId: string },
  feature: TriedFeature
): Promise<boolean> {
  if (!(await reachMilestoneOnce(deps, context.userId, feature))) return false;
  return trackEvent(deps, context, featureTriedEvent, { feature });
}
