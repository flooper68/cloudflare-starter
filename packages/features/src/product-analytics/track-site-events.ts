import type { AnalyticsContext, ProductAnalytics } from "../platform";
import {
  type AnalyticsEventCatalog,
  parseSiteBatch,
  type SiteBatch,
} from "./domain";

/**
 * Tracks a batch of anonymous events a public page reported (`POST /api/site-events`).
 * Every event must be a `site: true` event of the catalog with valid properties, or the
 * whole batch is refused with InvalidAnalyticsEventError. The context's user and
 * workspace are dropped: site events are never attributed to anyone.
 */
export function trackSiteEvents(
  deps: { readonly analytics: ProductAnalytics },
  context: AnalyticsContext,
  input: {
    readonly catalog: AnalyticsEventCatalog;
    readonly batch: SiteBatch;
  }
): { readonly tracked: number } {
  const events = parseSiteBatch(input.catalog, input.batch);
  const anonymous = { ...context, userId: null, workspaceId: null };
  for (const { definition, properties } of events) {
    deps.analytics.track(
      { event: definition.name, properties, layout: definition.layout },
      anonymous
    );
  }
  return { tracked: events.length };
}
