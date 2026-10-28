/**
 * Product analytics port, write-only, shaped after the Segment spec
 * (https://segment.com/docs/connections/spec/): `track` (an event a user caused, with its
 * properties) and `identify` (traits of the user). Features call it through `trackEvent`
 * and `identifyUser` of `product-analytics/`, which validate against the event catalog;
 * nothing reads analytics back through the app (querying happens outside it).
 *
 * Adapters: analytics-engine (Workers Analytics Engine, pseudonymous ids), noop, memory.
 * Synchronous and never throwing: analytics must not slow down or fail the work it
 * describes. Adapters drop what they cannot deliver.
 */
import type {
  AnalyticsEventLayout,
  AnalyticsProperties,
  RequestContext,
} from "../../kernel";

/**
 * Who and where an event happened: the Segment `userId` and `groupId` (the workspace),
 * and the `context` fields. Adapters that leave the app pseudonymize the ids.
 */
export type AnalyticsContext = Pick<
  RequestContext,
  "userId" | "workspaceId" | "environment" | "release" | "source"
>;

/** A Segment `track` call: `event` and `properties`, plus the catalog's slot layout. */
export interface TrackedEvent {
  readonly event: string;
  readonly properties: AnalyticsProperties;
  /** The catalog's order of the properties (column-oriented adapters store by it). */
  readonly layout: AnalyticsEventLayout;
}

/** A Segment `identify` call's `traits`, with the catalog's slot layout. */
export interface IdentifyTraits {
  readonly traits: AnalyticsProperties;
  readonly layout: AnalyticsEventLayout;
}

export interface ProductAnalytics {
  /** Records that something happened (Segment `track`). Never throws, never waits. */
  track(event: TrackedEvent, context: AnalyticsContext): void;
  /** Records the user's current traits (Segment `identify`). Never throws, never waits. */
  identify(context: AnalyticsContext, traits: IdentifyTraits): void;
}
