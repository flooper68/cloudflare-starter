import type { AnalyticsContext, ProductAnalytics } from "../platform";
import {
  type AnalyticsEventCatalog,
  type ClientBatch,
  parseClientBatch,
} from "./domain";

/**
 * Tracks a batch of events the browser reported (`analytics.track`). Every event must be
 * a `client: true` event of the catalog with valid properties, or the whole batch is
 * refused with InvalidAnalyticsEventError (invalid_input). The user and workspace come
 * from the caller's context, never from the batch.
 */
export function trackClientEvents(
  deps: { readonly analytics: ProductAnalytics },
  context: AnalyticsContext,
  input: {
    readonly catalog: AnalyticsEventCatalog;
    readonly batch: ClientBatch;
  }
): { readonly tracked: number } {
  const events = parseClientBatch(input.catalog, input.batch);
  for (const { definition, properties } of events) {
    deps.analytics.track(
      { event: definition.name, properties, layout: definition.layout },
      context
    );
  }
  return { tracked: events.length };
}
