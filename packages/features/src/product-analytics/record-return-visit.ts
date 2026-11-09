import type { AnalyticsContext } from "../platform";
import { sessionReturnedEvent, utcDaysBetween } from "./domain";
import { type MilestoneDeps, reachMilestoneOnce } from "./reach-milestone";
import { trackEvent } from "./track-event";

/**
 * The person opened the app on a later UTC day than they signed up on: sends
 * `app.session_returned` with the days since sign-up, the first time only, true when it
 * did. Visits on the sign-up day cost nothing. Never throws.
 */
export async function recordReturnVisit(
  deps: MilestoneDeps,
  context: AnalyticsContext & { readonly userId: string },
  signedUpAt: Date
): Promise<boolean> {
  const days = utcDaysBetween(signedUpAt, deps.clock.now());
  if (days < 1) return false;
  if (!(await reachMilestoneOnce(deps, context.userId, "returned")))
    return false;
  return trackEvent(deps, context, sessionReturnedEvent, {
    days_since_sign_up: days,
  });
}
