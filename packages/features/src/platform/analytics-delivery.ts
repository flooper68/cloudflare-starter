/**
 * What every ProductAnalytics adapter that delivers checks first: the event fits the
 * catalog limits (ANALYTICS_LIMITS), and the unit of work has not used up its points.
 * Adapters drop what fails, never throw.
 */
import {
  ANALYTICS_EVENT_NAME,
  ANALYTICS_LIMITS,
  type AnalyticsEventLayout,
  IDENTIFY_EVENT,
} from "../kernel";

/** Why an event cannot be delivered, or null when it can. */
export function undeliverableReason(
  event: string,
  layout: AnalyticsEventLayout
): string | null {
  if (event !== IDENTIFY_EVENT && !ANALYTICS_EVENT_NAME.test(event)) {
    return `event name "${event.slice(0, 80)}" is not <feature>.<object>_<verb>`;
  }
  if (event.length > ANALYTICS_LIMITS.nameLength) {
    return `event name longer than ${ANALYTICS_LIMITS.nameLength} characters`;
  }
  if (layout.strings.length > ANALYTICS_LIMITS.strings) {
    return `${layout.strings.length} string properties (at most ${ANALYTICS_LIMITS.strings})`;
  }
  if (layout.numbers.length > ANALYTICS_LIMITS.numbers) {
    return `${layout.numbers.length} numeric properties (at most ${ANALYTICS_LIMITS.numbers})`;
  }
  return null;
}

/**
 * Counts delivered points for one unit of work (Analytics Engine accepts 250 per
 * invocation). `take()` is true while points are left.
 */
export function createPointBudget(
  limit: number = ANALYTICS_LIMITS.pointsPerInvocation
): { take(): boolean } {
  let used = 0;
  return {
    take() {
      if (used >= limit) return false;
      used += 1;
      return true;
    },
  };
}
