import type { AnalyticsEventDefinition, AnalyticsProperties } from "../kernel";
import type { AnalyticsContext, ProductAnalytics } from "../platform";

/**
 * Tracks one product event from the catalog (Segment `track`): validates the properties
 * with the event's schema and hands the event to the ProductAnalytics port, which neither
 * waits nor throws. Call it after the change it describes succeeded. Properties that fail
 * the schema drop the event (it returns false) instead of failing the work it describes;
 * the use case's test asserts the event, so a drop shows up there.
 */
export function trackEvent<TProps extends AnalyticsProperties>(
  deps: { readonly analytics: ProductAnalytics },
  context: AnalyticsContext,
  event: AnalyticsEventDefinition<TProps>,
  properties: NoInfer<TProps>
): boolean {
  const parsed = event.properties.safeParse(properties);
  if (!parsed.success) return false;
  deps.analytics.track(
    { event: event.name, properties: parsed.data, layout: event.layout },
    context
  );
  return true;
}
