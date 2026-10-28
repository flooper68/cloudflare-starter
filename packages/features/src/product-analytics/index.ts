// Product analytics: the event catalog rules, client batches and identify traits, and the
// use cases features call to track (docs/guides/how-to-setup-product-analytics.md). The
// catalog itself is the composition root packages/features/src/analytics-events.ts.
export {
  type AnalyticsEventCatalog,
  type ClientBatch,
  type ClientEvent,
  clientBatchSchema,
  createEventCatalog,
  eventDefinitionProblems,
  IDENTIFY_TRAITS_LAYOUT,
  type IdentifyTraitValues,
  InvalidAnalyticsEventError,
  identifyTraitsSchema,
  layoutProblems,
  PERSONAL_DATA_PROPERTY,
  pageViewedEvent,
  parseClientBatch,
  WORKSPACE_SIZE_BUCKETS,
  type WorkspaceSizeBucket,
  workspaceSizeBucket,
} from "./domain";
export { identifyUser } from "./identify-user";
export { trackClientEvents } from "./track-client-events";
export { trackEvent } from "./track-event";
